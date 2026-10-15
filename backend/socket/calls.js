import crypto from "crypto";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import ChatRequest from "../models/chatRequest.model.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { checkCanMessage } from "../utils/messagePermissions.js";

// 1:1 voice/video call signaling. Media goes peer-to-peer over WebRTC; this
// module only brokers the handshake and keeps the authoritative call state.
// See docs/V2-REDESIGN.md §8.
//
// State lives in memory, like the rate limiters and presence map: fine for a
// single Render instance, and would need a shared store (Redis) to scale out.
//
// Design rules:
// - The invite carries no SDP. Session descriptions and ICE candidates include
//   IP addresses, so negotiation starts only after the callee accepts: ringing
//   someone never reveals either side's address.
// - A call is pinned to one socket per side (the caller's tab, and whichever of
//   the callee's tabs answered). Signaling is routed to those sockets only.
// - Only the server writes call history, so durations can't be forged.

export const RING_TIMEOUT_MS = Number(process.env.CALL_RING_TIMEOUT_MS) || 45_000;
export const RESUME_GRACE_MS = Number(process.env.CALL_RESUME_GRACE_MS) || 15_000;
const INVITES_PER_MINUTE = 5;
const MAX_SIGNAL_BYTES = 32 * 1024;
const KINDS = new Set(["audio", "video"]);

// callId -> call
const calls = new Map();
// userId -> callId. A user is in at most one call, ringing or active.
const callIdByUser = new Map();
// userId -> timestamps of recent invites
const recentInvites = new Map();

let deps = null;

/** Wired up once by socket.js, which owns io and the presence map. */
export const initCalls = ({ io, getSocketIds }) => {
  deps = { io, getSocketIds };
};

const emitToSocket = (socketId, event, payload) => {
  if (socketId) deps.io.to(socketId).emit(event, payload);
};

const emitToUserSockets = (userId, event, payload, { except } = {}) => {
  for (const socketId of deps.getSocketIds(userId)) {
    if (socketId !== except) emitToSocket(socketId, event, payload);
  }
};

const isValidCallId = (id) => typeof id === "string" && id.length > 0 && id.length <= 64;

const rateLimited = (userId) => {
  const now = Date.now();
  const recent = (recentInvites.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= INVITES_PER_MINUTE) {
    recentInvites.set(userId, recent);
    return true;
  }
  recent.push(now);
  recentInvites.set(userId, recent);
  return false;
};

/**
 * Calls are stricter than messages: a text message to a stranger is how a chat
 * request starts, but nobody should be able to ring a phone before the request
 * has been accepted.
 */
const checkCanCall = async (callerId, calleeId) => {
  const permission = await checkCanMessage(callerId, calleeId);
  if (!permission.ok) return permission;

  const accepted = await ChatRequest.exists({
    status: "accepted",
    $or: [
      { senderId: callerId, receiverId: calleeId },
      { senderId: calleeId, receiverId: callerId },
    ],
  });
  if (!accepted) return { ok: false, error: "forbidden" };

  const blockedConversation = await Conversation.exists({
    participants: { $all: [callerId, calleeId] },
    status: "blocked",
  });
  if (blockedConversation) return { ok: false, error: "forbidden" };

  return { ok: true };
};

const peerOf = (call, userId) => (userId === call.callerId ? call.calleeId : call.callerId);
const socketOf = (call, userId) => (userId === call.callerId ? call.callerSocketId : call.calleeSocketId);

const publicCall = (call, forUserId) => ({
  callId: call.id,
  kind: call.kind,
  state: call.state,
  role: forUserId === call.callerId ? "caller" : "callee",
  peerId: peerOf(call, forUserId),
  answeredAt: call.answeredAt,
});

// Writes the "Voice call · 2:31" / "Missed video call" line into the chat and
// pushes it to both people, like any other message.
const writeCallHistory = async (call, status) => {
  const durationMs = call.answeredAt ? Date.now() - call.answeredAt : 0;
  const { callerId, calleeId } = call;

  let conversation = await Conversation.findOne({ participants: { $all: [callerId, calleeId] } });
  if (!conversation) {
    conversation = await Conversation.create({ participants: [callerId, calleeId] });
  }

  const message = await Message.create({
    senderId: callerId,
    receiverId: calleeId,
    call: { kind: call.kind, status, durationMs },
  });
  conversation.messages.push(message._id);
  await conversation.save();

  emitToUserSockets(callerId, "newMessage", message);
  emitToUserSockets(calleeId, "newMessage", message);
};

const logHistory = (call, status) =>
  writeCallHistory(call, status).catch((error) => console.error("Error writing call history", error));

/**
 * Tears a call down and tells whoever is still connected why.
 * `reason` goes to clients; `status` is what the history records.
 */
const finishCall = (call, { reason, status, notify = "both", log = true }) => {
  if (!calls.has(call.id)) return;

  calls.delete(call.id);
  if (callIdByUser.get(call.callerId) === call.id) callIdByUser.delete(call.callerId);
  if (callIdByUser.get(call.calleeId) === call.id) callIdByUser.delete(call.calleeId);
  clearTimeout(call.ringTimer);
  for (const timer of Object.values(call.graceTimers)) clearTimeout(timer);

  const payload = { callId: call.id, reason };
  if (notify === "both" || notify === "caller") {
    emitToSocket(call.callerSocketId, "call:ended", payload);
  }
  if (notify === "both" || notify === "callee") {
    // While ringing, every one of the callee's tabs is showing the call.
    if (call.calleeSocketId) emitToSocket(call.calleeSocketId, "call:ended", payload);
    else emitToUserSockets(call.calleeId, "call:ended", payload);
  }

  if (log) logHistory(call, status);
};

const statusOnEnd = (call) => (call.state === "active" ? "completed" : "missed");

/** Ends any call between two users, e.g. because one just blocked the other. */
export const endCallsBetween = (userA, userB) => {
  const a = userA.toString();
  const b = userB.toString();
  const callId = callIdByUser.get(a);
  const call = callId && calls.get(callId);
  if (call && peerOf(call, a) === b) {
    finishCall(call, { reason: "ended", status: statusOnEnd(call), log: false });
  }
};

// Each handler gets (userId, payload) and returns the ack body.
const handlers = {
  async "call:invite"(socket, { to, kind } = {}) {
    const callerId = socket.userId;

    if (!mongoose.isValidObjectId(to) || !KINDS.has(kind)) {
      return { ok: false, reason: "invalid" };
    }
    const calleeId = String(to);
    if (calleeId === callerId) return { ok: false, reason: "invalid" };
    if (callIdByUser.has(callerId)) return { ok: false, reason: "already_in_call" };
    if (rateLimited(callerId)) return { ok: false, reason: "rate_limited" };

    const permission = await checkCanCall(callerId, calleeId);
    if (!permission.ok) return { ok: false, reason: "forbidden" };

    // Re-check after the awaits: another invite may have landed meanwhile.
    if (callIdByUser.has(callerId)) return { ok: false, reason: "already_in_call" };

    const call = {
      id: crypto.randomUUID(),
      kind,
      callerId,
      calleeId,
      callerSocketId: socket.id,
      calleeSocketId: null,
      state: "ringing",
      createdAt: Date.now(),
      answeredAt: null,
      ringing: false,
      ringTimer: null,
      graceTimers: {},
    };

    const calleeSockets = deps.getSocketIds(calleeId);
    if (callIdByUser.has(calleeId) || calleeSockets.length === 0) {
      // Not a live call, but the callee should still see that someone tried.
      logHistory(call, "missed");
      return { ok: false, reason: calleeSockets.length === 0 ? "unavailable" : "busy" };
    }

    calls.set(call.id, call);
    callIdByUser.set(callerId, call.id);
    callIdByUser.set(calleeId, call.id);

    call.ringTimer = setTimeout(
      () => finishCall(call, { reason: "no_answer", status: "missed" }),
      RING_TIMEOUT_MS
    );

    const caller = await User.findById(callerId).select("_id fullName username profilePic").lean();
    emitToUserSockets(calleeId, "call:incoming", {
      callId: call.id,
      kind,
      caller: { ...caller, _id: callerId },
    });

    return { ok: true, callId: call.id, ringTimeoutMs: RING_TIMEOUT_MS };
  },

  // A callee's device confirms it is showing the call, so the caller can show
  // "Ringing…" rather than "Calling…".
  async "call:ringing"(socket, { callId } = {}) {
    const call = isValidCallId(callId) && calls.get(callId);
    if (!call || call.calleeId !== socket.userId || call.state !== "ringing") return { ok: false };
    if (!call.ringing) {
      call.ringing = true;
      emitToSocket(call.callerSocketId, "call:ringing", { callId });
    }
    return { ok: true };
  },

  async "call:accept"(socket, { callId } = {}) {
    const call = isValidCallId(callId) && calls.get(callId);
    if (!call || call.calleeId !== socket.userId) return { ok: false, reason: "gone" };
    if (call.state !== "ringing") return { ok: false, reason: "answered_elsewhere" };

    // Blocks can land while a call is ringing.
    const permission = await checkCanCall(call.callerId, call.calleeId);
    if (!permission.ok) {
      finishCall(call, { reason: "ended", status: "missed", log: false });
      return { ok: false, reason: "gone" };
    }
    if (call.state !== "ringing" || !calls.has(call.id)) return { ok: false, reason: "answered_elsewhere" };

    call.state = "active";
    call.answeredAt = Date.now();
    call.calleeSocketId = socket.id;
    clearTimeout(call.ringTimer);

    emitToUserSockets(call.calleeId, "call:answered-elsewhere", { callId }, { except: socket.id });
    emitToSocket(call.callerSocketId, "call:accepted", { callId, answeredAt: call.answeredAt });

    return { ok: true, answeredAt: call.answeredAt };
  },

  async "call:reject"(socket, { callId } = {}) {
    const call = isValidCallId(callId) && calls.get(callId);
    if (!call || call.calleeId !== socket.userId || call.state !== "ringing") return { ok: false };
    finishCall(call, { reason: "declined", status: "declined" });
    return { ok: true };
  },

  async "call:cancel"(socket, { callId } = {}) {
    const call = isValidCallId(callId) && calls.get(callId);
    if (!call || call.callerSocketId !== socket.id || call.state !== "ringing") return { ok: false };
    finishCall(call, { reason: "cancelled", status: "missed", notify: "callee" });
    return { ok: true };
  },

  async "call:end"(socket, { callId } = {}) {
    const call = isValidCallId(callId) && calls.get(callId);
    if (!call || socketOf(call, socket.userId) !== socket.id) return { ok: false };
    const notify = socket.userId === call.callerId ? "callee" : "caller";
    finishCall(call, { reason: "hangup", status: statusOnEnd(call), notify });
    return { ok: true };
  },

  // Opaque WebRTC payloads (SDP, ICE candidates). Relayed only between the two
  // pinned sockets of an active call, never read.
  async "call:signal"(socket, { callId, data } = {}) {
    const call = isValidCallId(callId) && calls.get(callId);
    if (!call || call.state !== "active" || socketOf(call, socket.userId) !== socket.id) {
      return { ok: false };
    }
    let size;
    try {
      size = Buffer.byteLength(JSON.stringify(data ?? null));
    } catch {
      return { ok: false };
    }
    if (size > MAX_SIGNAL_BYTES) return { ok: false };

    const peerSocket = socketOf(call, peerOf(call, socket.userId));
    emitToSocket(peerSocket, "call:signal", { callId, data });
    return { ok: true };
  },

  // A tab that lost its socket (network blip, laptop sleep) reclaims its call
  // from the new socket. Media kept flowing peer-to-peer meanwhile.
  async "call:resume"(socket, { callId } = {}) {
    const userId = socket.userId;
    const call = isValidCallId(callId) && calls.get(callId);
    if (!call || (call.callerId !== userId && call.calleeId !== userId)) return { ok: false };
    if (call.state === "ringing" && userId === call.calleeId) return { ok: false };
    if (!call.graceTimers[userId]) {
      // Only a socket that actually dropped can be replaced, so another tab
      // can't steal a call that is still connected elsewhere.
      return { ok: false };
    }

    clearTimeout(call.graceTimers[userId]);
    delete call.graceTimers[userId];
    if (userId === call.callerId) call.callerSocketId = socket.id;
    else call.calleeSocketId = socket.id;

    emitToSocket(socketOf(call, peerOf(call, userId)), "call:peer-reconnected", { callId });
    return { ok: true, call: publicCall(call, userId) };
  },
};

/** Call this from io.on("connection"). */
export const registerCallHandlers = (socket) => {
  for (const [event, handler] of Object.entries(handlers)) {
    socket.on(event, async (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        reply(await handler(socket, payload && typeof payload === "object" ? payload : {}));
      } catch (error) {
        console.error(`Error in ${event}`, error);
        reply({ ok: false, reason: "error" });
      }
    });
  }

  // A tab that connects while its user is mid-call (e.g. after a reload) is
  // told about it, so it can offer to resume rather than silently diverge.
  const callId = callIdByUser.get(socket.userId);
  const call = callId && calls.get(callId);
  if (call && call.graceTimers[socket.userId]) {
    emitToSocket(socket.id, "call:resumable", publicCall(call, socket.userId));
  }
};

/** Call this from the socket's "disconnect" handler. */
export const handleCallSocketDisconnect = (socket) => {
  const userId = socket.userId;
  const callId = callIdByUser.get(userId);
  const call = callId && calls.get(callId);
  if (!call || socketOf(call, userId) !== socket.id) return;

  emitToSocket(socketOf(call, peerOf(call, userId)), "call:peer-reconnecting", { callId });

  call.graceTimers[userId] = setTimeout(() => {
    delete call.graceTimers[userId];
    const notify = userId === call.callerId ? "callee" : "caller";
    finishCall(call, { reason: "disconnected", status: statusOnEnd(call), notify });
  }, RESUME_GRACE_MS);
};

// For tests and diagnostics.
export const activeCallCount = () => calls.size;

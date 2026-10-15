import { Server } from "socket.io";
import http from "http";
import express from "express";
import User from "../models/user.model.js";
import { getPresenceContactIds } from "../utils/relationships.js";
import { SESSION_COOKIE, decodeSessionToken } from "../utils/session.js";
import { initCalls, registerCallHandlers, handleCallSocketDisconnect } from "./calls.js";

// Minimal Cookie-header parser. Socket.IO hands us the raw header and
// cookie-parser only runs on Express requests, so we read the one cookie we
// need here rather than taking a dependency for it.
const parseCookies = (header) => {
  const out = {};
  if (!header) return out;

  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;

    const name = part.slice(0, eq).trim();
    if (!name || name in out) continue; // first occurrence wins, per RFC 6265

    let value = part.slice(eq + 1).trim();
    if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    try {
      value = decodeURIComponent(value);
    } catch {
      // Malformed percent-encoding: keep the raw value; jwt.verify will reject
      // it if it is not a real token anyway.
    }
    out[name] = value;
  }
  return out;
};

const app = express();

const server = http.createServer(app);

// In production the SPA is served from this same origin, so no cross-origin
// allowance is needed. In development Vite runs on :3000. Extra origins can be
// added via CLIENT_ORIGINS (comma separated).
const allowedOrigins = [
  ...(process.env.NODE_ENV === "development" ? ["http://localhost:3000"] : []),
  ...(process.env.CLIENT_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean) ?? []),
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : false,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// setTimeout overflows above this and fires immediately.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
// A client may re-request its presence list, but not in a tight loop.
const PRESENCE_REQUEST_INTERVAL_MS = 2000;

// Identity comes from the signed JWT cookie only. It must never be read from
// the handshake query: that is client-controlled, so anyone could claim to be
// any user and receive their messages.
io.use(async (socket, next) => {
  try {
    const token = parseCookies(socket.handshake.headers.cookie)[SESSION_COOKIE];
    const decoded = decodeSessionToken(token);
    if (!decoded) return next(new Error("unauthorized"));

    const user = await User.findById(decoded.userId).select("_id");
    if (!user) return next(new Error("unauthorized"));

    socket.userId = user._id.toString();
    socket.data.token = token;
    socket.data.expiresAt = decoded.exp * 1000;
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

// userId -> Set of socket ids. A user may have several tabs or devices open at
// once, so presence only drops when the last of them disconnects.
const userSockets = new Map();

export const getReceiverSocketIds = (receiverId) => {
  return [...(userSockets.get(receiverId?.toString()) ?? [])];
};

export const isUserOnline = (userId) => userSockets.has(userId?.toString());

export const emitToUser = (userId, event, payload) => {
  const socketIds = getReceiverSocketIds(userId);
  if (socketIds.length) io.to(socketIds).emit(event, payload);
};

/**
 * Disconnects the sockets opened with this exact session token — every tab of
 * the browser that just logged out — without touching the user's other
 * devices, which hold different tokens.
 */
export const disconnectSession = (userId, token) => {
  for (const socketId of getReceiverSocketIds(userId)) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket?.data.token === token) socket.disconnect(true);
  }
};

initCalls({ io, getSocketIds: getReceiverSocketIds });

const onlineContactsOf = async (userId) => (await getPresenceContactIds(userId)).filter(isUserOnline);

// Presence goes only to accepted contacts. It used to be broadcast to every
// connected client, which told anyone — including people you had blocked —
// exactly when you were online.
const announcePresence = async (userId, event) => {
  for (const contactId of await getPresenceContactIds(userId)) {
    emitToUser(contactId, event, userId);
  }
};

/**
 * Re-evaluates whether two users may see each other's presence and tells both
 * sides. Call after anything that changes their relationship: a request being
 * accepted or declined, a block or an unblock.
 */
export const syncPresenceBetween = async (a, b) => {
  const [aId, bId] = [a.toString(), b.toString()];
  const visible = (await getPresenceContactIds(aId)).includes(bId);

  if (isUserOnline(aId)) emitToUser(bId, visible ? "userOnline" : "userOffline", aId);
  if (isUserOnline(bId)) emitToUser(aId, visible ? "userOnline" : "userOffline", bId);
};

const logSocketError = (context) => (error) => console.error(`socket ${context}:`, error);

io.on("connection", (socket) => {
  const { userId } = socket;

  const isFirstSocket = !userSockets.has(userId);
  if (isFirstSocket) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socket.id);

  // The token was checked once at handshake. Without this, a socket outlives
  // the session that opened it for as long as the connection stays up.
  const expiryTimer = setTimeout(
    () => socket.disconnect(true),
    Math.min(Math.max(socket.data.expiresAt - Date.now(), 0), MAX_TIMEOUT_MS)
  );

  // Handlers are registered before any await so no event can slip past them.
  registerCallHandlers(socket);

  socket.on("disconnect", () => {
    clearTimeout(expiryTimer);
    handleCallSocketDisconnect(socket);

    const sockets = userSockets.get(userId);
    if (!sockets) return;

    sockets.delete(socket.id);
    if (sockets.size === 0) {
      userSockets.delete(userId);
      announcePresence(userId, "userOffline").catch(logSocketError("presence"));
    }
  });

  let lastPresenceRequest = 0;
  socket.on("getOnlineUsers", () => {
    const now = Date.now();
    if (now - lastPresenceRequest < PRESENCE_REQUEST_INTERVAL_MS) return;
    lastPresenceRequest = now;

    onlineContactsOf(userId)
      .then((ids) => socket.emit("onlineUsers", ids))
      .catch(logSocketError("presence"));
  });

  onlineContactsOf(userId)
    .then((ids) => socket.emit("onlineUsers", ids))
    .catch(logSocketError("presence"));

  if (isFirstSocket) {
    announcePresence(userId, "userOnline").catch(logSocketError("presence"));
  }
});

export { app, io, server };

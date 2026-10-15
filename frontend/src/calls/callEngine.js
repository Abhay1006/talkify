import { useCallStore } from "./callStore";
import { startTone, stopTone, playEndTone } from "./tones";

// Client half of 1:1 calls (docs/V2-REDESIGN.md §8). One call at a time per
// tab. The server (backend/socket/calls.js) owns call state; this owns media
// and the RTCPeerConnection.
//
// Negotiation follows the WebRTC "perfect negotiation" pattern: the caller is
// the impolite peer, the callee the polite one, so offers that cross (e.g. two
// ICE restarts at once) resolve themselves instead of deadlocking.
//
// Every call negotiates one audio and one video transceiver up front, even
// for voice calls. Turning the camera on later is then just replaceTrack() on
// the existing video sender — no renegotiation mid-call.

const CONNECT_TIMEOUT_MS = 25_000;
const RECOVERY_TIMEOUT_MS = 20_000;
const ICE_RESTART_DELAY_MS = 2_500;
const ENDED_SCREEN_MS = 2_200;
const STATS_INTERVAL_MS = 2_000;

const AUDIO_CONSTRAINTS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const videoConstraints = (facingMode) => ({ facingMode, width: { ideal: 1280 }, height: { ideal: 720 } });

const get = () => useCallStore.getState();
const set = (patch) => useCallStore.setState(patch);
const setCall = (patch) => useCallStore.setState((s) => (s.call ? { call: { ...s.call, ...patch } } : {}));

let socket = null;
let resolvePeer = (id) => ({ _id: id, fullName: "Unknown", profilePic: "" });
let pc = null;
let localStream = null;
let remoteStream = null;
let negotiation = null;
let tracksAttached = false;
let pendingSignals = [];
let timers = {};
let statsTimer = null;
let lastStats = null;
let iceServersPromise = null;
let wakeLock = null;

export class CallError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

// ---------------------------------------------------------------- helpers

const clearTimer = (name) => {
  clearTimeout(timers[name]);
  delete timers[name];
};

const clearAllTimers = () => {
  Object.values(timers).forEach(clearTimeout);
  timers = {};
};

const ack = (event, payload, timeout = 8000) =>
  new Promise((resolve) => {
    if (!socket?.connected) return resolve({ ok: false, reason: "offline" });
    socket
      .timeout(timeout)
      .emit(event, payload, (err, reply) =>
        resolve(err ? { ok: false, reason: "timeout" } : (reply ?? { ok: false }))
      );
  });

const currentCallId = () => get().call?.callId;

const sendSignal = (data) => {
  const callId = currentCallId();
  if (callId && socket?.connected) socket.emit("call:signal", { callId, data });
};

const sendMediaState = () => sendSignal({ media: { mic: get().micOn, cam: get().camOn } });

const loadIceServers = () => {
  if (!iceServersPromise) {
    iceServersPromise = fetch("/api/calls/ice-servers")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("ice"))))
      .then((body) => body.iceServers)
      .catch(() => {
        iceServersPromise = null; // retry next time
        return [{ urls: "stun:stun.l.google.com:19302" }];
      });
  }
  return iceServersPromise;
};

/** getUserMedia with failures translated into something we can explain. */
export const getMedia = async (kind, facingMode = "user") => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CallError(window.isSecureContext ? "unsupported" : "insecure");
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: AUDIO_CONSTRAINTS,
      video: kind === "video" ? videoConstraints(facingMode) : false,
    });
  } catch (error) {
    if (
      kind === "video" &&
      ["NotFoundError", "OverconstrainedError", "NotReadableError"].includes(error.name)
    ) {
      // No usable camera: carry on as a voice call rather than failing.
      const audioOnly = await getMedia("audio");
      audioOnly.cameraUnavailable = error.name === "NotReadableError" ? "busy" : "missing";
      return audioOnly;
    }
    if (error.name === "NotAllowedError" || error.name === "SecurityError")
      throw new CallError(kind === "video" ? "permission_denied_video" : "permission_denied");
    if (error.name === "NotFoundError") throw new CallError("no_microphone");
    if (error.name === "NotReadableError") throw new CallError("device_busy");
    throw new CallError("media_failed");
  }
};

const refreshCanFlip = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    set({ canFlipCamera: devices.filter((d) => d.kind === "videoinput").length > 1 });
  } catch {
    set({ canFlipCamera: false });
  }
};

const stopLocalMedia = () => {
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
};

const videoTransceiver = () => pc?.getTransceivers().find((t) => t.receiver.track?.kind === "video");

// Keep the screen on during calls, mostly for phones on video calls.
const acquireWakeLock = async () => {
  try {
    if (!wakeLock && navigator.wakeLock && document.visibilityState === "visible") {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    }
  } catch {
    wakeLock = null;
  }
};

const releaseWakeLock = () => {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
};

// A wake lock is dropped whenever the tab is hidden; take it back on return.
document.addEventListener("visibilitychange", () => {
  const phase = get().call?.phase;
  if (
    document.visibilityState === "visible" &&
    (phase === "active" || phase === "connecting" || phase === "reconnecting")
  ) {
    acquireWakeLock();
  }
});

// ---------------------------------------------------------------- stats

const QUALITY_THRESHOLDS = { good: { rtt: 0.3, loss: 0.02 }, fair: { rtt: 0.6, loss: 0.08 } };

const sampleStats = async () => {
  if (!pc) return;
  try {
    const report = await pc.getStats();
    let rtt = null;
    let lost = 0;
    let received = 0;
    report.forEach((s) => {
      if (
        s.type === "candidate-pair" &&
        s.nominated &&
        s.state === "succeeded" &&
        s.currentRoundTripTime != null
      ) {
        rtt = s.currentRoundTripTime;
      }
      if (s.type === "inbound-rtp" && s.kind === "audio") {
        lost += s.packetsLost ?? 0;
        received += s.packetsReceived ?? 0;
      }
    });
    // The first sample has no previous one to diff against: use totals so far.
    const prev = lastStats ?? { lost: 0, received: 0 };
    lastStats = { lost, received };
    const dLost = Math.max(0, lost - prev.lost);
    const dTotal = dLost + Math.max(0, received - prev.received);
    const loss = dTotal ? dLost / dTotal : 0;
    const r = rtt ?? 0;
    const quality =
      r < QUALITY_THRESHOLDS.good.rtt && loss < QUALITY_THRESHOLDS.good.loss
        ? "good"
        : r < QUALITY_THRESHOLDS.fair.rtt && loss < QUALITY_THRESHOLDS.fair.loss
          ? "fair"
          : "poor";
    if (get().quality !== quality) set({ quality });
  } catch {
    // getStats can throw while the connection is being torn down.
  }
};

const startStats = () => {
  if (statsTimer) return;
  lastStats = null;
  statsTimer = setInterval(sampleStats, STATS_INTERVAL_MS);
  setTimeout(sampleStats, 500);
};

const stopStats = () => {
  clearInterval(statsTimer);
  statsTimer = null;
  lastStats = null;
};

// ---------------------------------------------------------------- peer

const closePeer = () => {
  stopStats();
  if (pc) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onnegotiationneeded = null;
    pc.onconnectionstatechange = null;
    pc.close();
  }
  pc = null;
  negotiation = null;
  tracksAttached = false;
  pendingSignals = [];
};

const onConnectionState = () => {
  if (!pc) return;
  const state = pc.connectionState;
  const phase = get().call?.phase;

  if (state === "connected") {
    clearTimer("connect");
    clearTimer("restart");
    clearTimer("recover");
    setCall({ phase: "active", connectedAt: get().call?.connectedAt ?? Date.now() });
    sendMediaState();
    startStats();
    acquireWakeLock();
    return;
  }

  if ((state === "disconnected" || state === "failed") && (phase === "active" || phase === "reconnecting")) {
    setCall({ phase: "reconnecting" });
    // A brief 'disconnected' often heals by itself; restart ICE only if not.
    if (!timers.restart) {
      timers.restart = setTimeout(
        () => {
          delete timers.restart;
          if (pc && pc.connectionState !== "connected") pc.restartIce();
        },
        state === "failed" ? 0 : ICE_RESTART_DELAY_MS
      );
    }
    if (!timers.recover) {
      timers.recover = setTimeout(() => failCall("lost"), RECOVERY_TIMEOUT_MS);
    }
  }

  if (state === "failed" && phase === "connecting") {
    failCall("connect");
  }
};

const createPeer = async (role) => {
  closePeer();
  const iceServers = await loadIceServers();
  pc = new RTCPeerConnection({ iceServers });
  negotiation = { polite: role === "callee", makingOffer: false, ignoreOffer: false, settingAnswer: false };
  remoteStream = new MediaStream();
  set({ remoteStream, remoteVersion: get().remoteVersion + 1 });

  pc.ontrack = ({ track }) => {
    remoteStream.addTrack(track);
    set({ remoteVersion: get().remoteVersion + 1 });
  };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) sendSignal({ candidate: candidate.toJSON() });
  };

  pc.onnegotiationneeded = async () => {
    const thisPc = pc;
    try {
      negotiation.makingOffer = true;
      await thisPc.setLocalDescription();
      if (thisPc === pc) sendSignal({ description: thisPc.localDescription.toJSON() });
    } catch (error) {
      console.warn("negotiation failed", error);
    } finally {
      if (negotiation) negotiation.makingOffer = false;
    }
  };

  pc.onconnectionstatechange = onConnectionState;

  // The caller defines the media sections; the callee fills them in when the
  // offer arrives (attachLocalTracks).
  if (role === "caller") {
    pc.addTransceiver(localStream?.getAudioTracks()[0] ?? "audio", { direction: "sendrecv" });
    pc.addTransceiver(localStream?.getVideoTracks()[0] ?? "video", { direction: "sendrecv" });
    tracksAttached = true;
  }

  const queued = pendingSignals;
  pendingSignals = [];
  for (const data of queued) await handleSignal(data);
};

const attachLocalTracks = async () => {
  if (tracksAttached || !pc) return;
  tracksAttached = true;
  for (const t of pc.getTransceivers()) {
    const kind = t.receiver.track?.kind;
    const track = kind === "audio" ? localStream?.getAudioTracks()[0] : localStream?.getVideoTracks()[0];
    t.direction = "sendrecv";
    await t.sender.replaceTrack(track ?? null);
  }
};

const handleSignal = async (data) => {
  if (!data || typeof data !== "object") return;

  if (data.media) {
    set({ peerMicOn: !!data.media.mic, peerCamOn: !!data.media.cam });
    return;
  }

  // The other side reloaded and rejoined: start a fresh connection.
  if (data.restart) {
    const call = get().call;
    if (!call) return;
    setCall({ phase: "connecting" });
    await createPeer(call.role);
    armConnectTimeout();
    return;
  }

  if (!pc) {
    pendingSignals.push(data);
    return;
  }

  try {
    if (data.description) {
      const description = data.description;
      const readyForOffer =
        !negotiation.makingOffer && (pc.signalingState === "stable" || negotiation.settingAnswer);
      const offerCollision = description.type === "offer" && !readyForOffer;
      negotiation.ignoreOffer = !negotiation.polite && offerCollision;
      if (negotiation.ignoreOffer) return;

      negotiation.settingAnswer = description.type === "answer";
      await pc.setRemoteDescription(description);
      negotiation.settingAnswer = false;

      if (description.type === "offer") {
        await attachLocalTracks();
        await pc.setLocalDescription();
        sendSignal({ description: pc.localDescription.toJSON() });
      }
    } else if (data.candidate) {
      try {
        await pc.addIceCandidate(data.candidate);
      } catch (error) {
        if (!negotiation.ignoreOffer) throw error;
      }
    }
  } catch (error) {
    console.warn("signal handling failed", error);
  }
};

const armConnectTimeout = () => {
  clearTimer("connect");
  timers.connect = setTimeout(() => failCall("connect"), CONNECT_TIMEOUT_MS);
};

// ---------------------------------------------------------------- teardown

const teardown = () => {
  stopTone();
  clearAllTimers();
  closePeer();
  stopLocalMedia();
  releaseWakeLock();
  remoteStream = null;
  set({ localStream: null, remoteStream: null, quality: null, peerReconnecting: false });
};

/** Moves to a closing screen that dismisses itself. */
const showEnded = (endReason) => {
  const call = get().call;
  if (!call) return;
  teardown();
  if (call.phase === "active" || call.phase === "reconnecting" || call.phase === "connecting") playEndTone();
  setCall({ phase: "ended", endReason });
  scheduleDismiss(ENDED_SCREEN_MS);
};

// Closes the ended screen after `ms`, unless something else has replaced it.
const scheduleDismiss = (ms) => {
  const endedAt = Date.now();
  setCall({ endedAt });
  timers.dismiss = setTimeout(() => {
    if (get().call?.phase === "ended" && get().call?.endedAt === endedAt) set({ call: null });
  }, ms);
};

const failCall = (failure) => {
  const call = get().call;
  if (!call || call.phase === "ended" || call.phase === "failed") return;
  if (call.callId) ack("call:end", { callId: call.callId });
  teardown();
  playEndTone();
  setCall({ phase: "failed", failure });
};

const showError = (error) => {
  teardown();
  setCall({ phase: "error", error: error instanceof CallError ? error.code : "media_failed" });
};

// ---------------------------------------------------------------- actions

export const startCall = async (peer, kind) => {
  if (get().call && !["ended", "failed", "error"].includes(get().call.phase)) return;
  clearAllTimers();
  set({
    call: { phase: "preparing", role: "caller", kind, peer, callId: null },
    micOn: true,
    camOn: false,
    facingMode: "user",
    peerMicOn: true,
    peerCamOn: false,
    quality: null,
  });

  try {
    localStream = await getMedia(kind);
  } catch (error) {
    showError(error);
    return;
  }
  if (get().call?.phase !== "preparing") {
    // Hung up while the permission prompt was open.
    stopLocalMedia();
    return;
  }
  const camOn = localStream.getVideoTracks().length > 0;
  set({ localStream, camOn });
  if (localStream.cameraUnavailable) setCall({ notice: `camera_${localStream.cameraUnavailable}` });
  if (camOn) refreshCanFlip();

  const reply = await ack("call:invite", { to: peer._id, kind });
  const call = get().call;
  if (!call || call.phase !== "preparing") {
    // Hung up while the invite was in flight.
    if (reply.ok) ack("call:cancel", { callId: reply.callId });
    return;
  }
  if (!reply.ok) {
    teardown();
    setCall({
      phase: "ended",
      endReason: reply.reason === "offline" || reply.reason === "timeout" ? "not_connected" : reply.reason,
    });
    // These explain why nobody was rung, so leave them up a little longer.
    scheduleDismiss(ENDED_SCREEN_MS + 1500);
    return;
  }

  setCall({ callId: reply.callId, phase: "calling" });
  startTone("ringback");
};

export const acceptCall = async ({ video }) => {
  const call = get().call;
  if (!call || call.phase !== "incoming") return;
  stopTone();
  setCall({ phase: "connecting" });

  try {
    localStream = await getMedia(video ? "video" : "audio");
  } catch (error) {
    // Can't answer without a microphone. Free the caller rather than leaving
    // them ringing until the timeout.
    ack("call:reject", { callId: call.callId });
    showError(error);
    return;
  }
  const camOn = localStream.getVideoTracks().length > 0;
  set({
    localStream,
    camOn,
    micOn: true,
    facingMode: "user",
    peerMicOn: true,
    peerCamOn: false,
    quality: null,
  });
  if (localStream.cameraUnavailable) setCall({ notice: `camera_${localStream.cameraUnavailable}` });
  if (camOn) refreshCanFlip();

  await createPeer("callee");
  const reply = await ack("call:accept", { callId: call.callId });
  if (get().call?.callId !== call.callId) return;
  if (!reply.ok) {
    showEnded(reply.reason === "answered_elsewhere" ? "answered_elsewhere" : "gone");
    return;
  }
  armConnectTimeout();
  acquireWakeLock();
};

export const declineCall = () => {
  const call = get().call;
  if (!call || call.phase !== "incoming") return;
  stopTone();
  ack("call:reject", { callId: call.callId });
  set({ call: null });
};

export const hangUp = () => {
  const call = get().call;
  if (!call) return;
  switch (call.phase) {
    case "preparing":
      teardown();
      set({ call: null });
      return;
    case "calling":
    case "ringing":
      ack("call:cancel", { callId: call.callId });
      showEnded("cancelled_by_me");
      return;
    case "incoming":
      declineCall();
      return;
    case "connecting":
    case "active":
    case "reconnecting":
      ack("call:end", { callId: call.callId });
      showEnded("hangup_by_me");
      return;
    default:
      teardown();
      set({ call: null });
  }
};

/** Closes a finished/failed/error screen. */
export const dismissCall = () => {
  const phase = get().call?.phase;
  if (phase === "ended" || phase === "failed" || phase === "error") {
    teardown();
    set({ call: null });
  }
};

/** Calls the same person again after a failure. */
export const retryCall = () => {
  const call = get().call;
  if (!call) return;
  const { peer, kind } = call;
  teardown();
  set({ call: null });
  startCall(peer, kind);
};

export const toggleMic = () => {
  const track = localStream?.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  set({ micOn: track.enabled });
  sendMediaState();
};

export const toggleCamera = async () => {
  if (!localStream) return;
  const sender = videoTransceiver()?.sender;

  if (get().camOn) {
    // Stop the track (not just disable it) so the camera light goes off.
    localStream.getVideoTracks().forEach((t) => {
      t.stop();
      localStream.removeTrack(t);
    });
    await sender?.replaceTrack(null);
    set({ camOn: false, localStream: new MediaStream(localStream.getTracks()) });
    localStream = get().localStream;
    sendMediaState();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(get().facingMode) });
    const track = stream.getVideoTracks()[0];
    localStream.addTrack(track);
    await sender?.replaceTrack(track);
    set({ camOn: true, localStream: new MediaStream(localStream.getTracks()) });
    localStream = get().localStream;
    sendMediaState();
    refreshCanFlip();
  } catch (error) {
    setCall({ notice: error.name === "NotAllowedError" ? "camera_denied" : "camera_missing" });
  }
};

export const flipCamera = async () => {
  if (!get().camOn || !localStream) return;
  const facingMode = get().facingMode === "user" ? "environment" : "user";
  try {
    // Stop the old track first: many phones can't open both cameras at once.
    localStream.getVideoTracks().forEach((t) => {
      t.stop();
      localStream.removeTrack(t);
    });
    const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(facingMode) });
    const track = stream.getVideoTracks()[0];
    localStream.addTrack(track);
    await videoTransceiver()?.sender.replaceTrack(track);
    set({ facingMode, localStream: new MediaStream(localStream.getTracks()) });
    localStream = get().localStream;
  } catch {
    setCall({ notice: "camera_missing" });
    set({ camOn: false });
    sendMediaState();
  }
};

export const clearNotice = () => setCall({ notice: null });

/** Rejoin a call this user is still in after reloading the page. */
export const rejoinCall = async () => {
  const info = get().resumable;
  if (!info) return;
  set({ resumable: null });
  const reply = await ack("call:resume", { callId: info.callId });
  if (!reply.ok) return;

  set({
    call: {
      phase: "connecting",
      role: info.role,
      kind: info.kind,
      callId: info.callId,
      peer: resolvePeer(info.peerId),
    },
    micOn: true,
    camOn: false,
    peerMicOn: true,
    peerCamOn: false,
  });
  try {
    localStream = await getMedia(info.kind);
  } catch (error) {
    ack("call:end", { callId: info.callId });
    showError(error);
    return;
  }
  set({ localStream, camOn: localStream.getVideoTracks().length > 0 });
  // Tell the other side to drop its dead connection before we offer anew.
  sendSignal({ restart: true });
  await createPeer(info.role);
  armConnectTimeout();
};

export const leaveResumableCall = async () => {
  const info = get().resumable;
  set({ resumable: null });
  if (!info) return;
  const reply = await ack("call:resume", { callId: info.callId });
  if (reply.ok) ack("call:end", { callId: info.callId });
};

// ---------------------------------------------------------------- socket

const listeners = {
  "call:incoming": ({ callId, kind, caller }) => {
    if (get().call && !["ended", "failed", "error"].includes(get().call.phase)) return;
    clearAllTimers();
    set({ call: { phase: "incoming", role: "callee", callId, kind, peer: caller } });
    socket.emit("call:ringing", { callId });
    startTone("ringtone");
  },

  "call:ringing": ({ callId }) => {
    if (currentCallId() === callId && get().call.phase === "calling") setCall({ phase: "ringing" });
  },

  "call:accepted": async ({ callId }) => {
    if (currentCallId() !== callId) return;
    stopTone();
    setCall({ phase: "connecting" });
    await createPeer("caller");
    armConnectTimeout();
    acquireWakeLock();
  },

  "call:answered-elsewhere": ({ callId }) => {
    if (currentCallId() === callId && get().call.phase === "incoming") {
      stopTone();
      set({ call: null });
    }
  },

  "call:ended": ({ callId, reason }) => {
    const call = get().call;
    if (!call || call.callId !== callId) return;
    if (call.phase === "incoming") {
      stopTone();
      set({ call: null });
      return;
    }
    if (call.phase === "failed" || call.phase === "error") return;
    showEnded(reason);
  },

  "call:signal": ({ callId, data }) => {
    if (currentCallId() === callId) handleSignal(data);
  },

  "call:peer-reconnecting": ({ callId }) => {
    if (currentCallId() === callId) set({ peerReconnecting: true });
  },

  "call:peer-reconnected": ({ callId }) => {
    if (currentCallId() === callId) set({ peerReconnecting: false });
  },

  "call:resumable": (info) => {
    if (currentCallId() === info.callId) return;
    if (info.state !== "active") return;
    set({ resumable: info });
  },

  // Socket.IO reconnected (new socket id): reclaim the call from it.
  connect: async () => {
    const call = get().call;
    if (!call?.callId || !["calling", "ringing", "connecting", "active", "reconnecting"].includes(call.phase))
      return;
    const reply = await ack("call:resume", { callId: call.callId });
    if (!reply.ok && currentCallId() === call.callId) showEnded("disconnected");
  },
};

/** Binds the engine to the app's socket. Returns an unbind function. */
export const attachCallEngine = (newSocket, { peerResolver } = {}) => {
  socket = newSocket;
  if (peerResolver) resolvePeer = peerResolver;
  for (const [event, handler] of Object.entries(listeners)) socket.on(event, handler);
  return () => {
    for (const [event, handler] of Object.entries(listeners)) newSocket.off(event, handler);
    if (socket === newSocket) {
      // Logged out or socket replaced: nothing about a call survives that.
      teardown();
      set({ call: null, resumable: null });
      socket = null;
    }
  };
};

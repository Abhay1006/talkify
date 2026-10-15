import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  startServer,
  signup,
  befriend,
  connect,
  emit,
  waitFor,
  staysQuiet,
  sleep,
  closeAllSockets,
  api,
  skipWithoutMongo,
} from "./helpers.js";

describe("calls", { skip: skipWithoutMongo }, () => {
  const RING_TIMEOUT_MS = 1200;
  const GRACE_MS = 800;

  let server;
  let url;

  before(async () => {
    server = await startServer({
      CALL_RING_TIMEOUT_MS: String(RING_TIMEOUT_MS),
      CALL_RESUME_GRACE_MS: String(GRACE_MS),
    });
    url = server.url;
  });

  after(async () => {
    closeAllSockets();
    await server?.stop();
  });

  afterEach(() => closeAllSockets());

  const friends = async () => {
    const a = await signup(url, "caller");
    const b = await signup(url, "callee");
    await befriend(url, a, b);
    return [a, b];
  };

  const historyFor = (socket) => waitFor(socket, "newMessage", { where: (m) => !!m.call });

  test("full call: ring, accept on one tab, relay signals, hang up, history", async () => {
    const [a, b] = await friends();
    const sa = await connect(url, a);
    const sb1 = await connect(url, b);
    const sb2 = await connect(url, b);

    const incoming1 = waitFor(sb1, "call:incoming");
    const incoming2 = waitFor(sb2, "call:incoming");
    const invite = await emit(sa, "call:invite", { to: b.id, kind: "video" });
    assert.equal(invite.ok, true);

    const [i1, i2] = await Promise.all([incoming1, incoming2]);
    assert.equal(i1.callId, invite.callId);
    assert.equal(i2.callId, invite.callId);
    assert.equal(i1.kind, "video");
    assert.equal(i1.caller._id, a.id);
    assert.equal(i1.caller.fullName, "caller");
    assert.equal(i1.caller.password, undefined);
    assert.equal(JSON.stringify(i1).includes("sdp"), false, "invite must not carry SDP");

    const ringing = waitFor(sa, "call:ringing");
    await emit(sb1, "call:ringing", { callId: invite.callId });
    await ringing;

    // Signaling before accept is refused: no addresses leak while ringing.
    assert.equal((await emit(sa, "call:signal", { callId: invite.callId, data: { sdp: "x" } })).ok, false);

    const accepted = waitFor(sa, "call:accepted");
    const elsewhere = waitFor(sb2, "call:answered-elsewhere");
    assert.equal((await emit(sb1, "call:accept", { callId: invite.callId })).ok, true);
    await Promise.all([accepted, elsewhere]);

    // The other tab can't answer too.
    assert.equal((await emit(sb2, "call:accept", { callId: invite.callId })).reason, "answered_elsewhere");

    // Signals go to the answering tab only.
    const toB1 = waitFor(sb1, "call:signal");
    const quietB2 = staysQuiet(sb2, "call:signal");
    assert.equal(
      (
        await emit(sa, "call:signal", {
          callId: invite.callId,
          data: { description: { type: "offer", sdp: "v=0" } },
        })
      ).ok,
      true
    );
    assert.deepEqual((await toB1).data, { description: { type: "offer", sdp: "v=0" } });
    assert.equal(await quietB2, true);

    // The non-answering tab can't inject signals.
    assert.equal((await emit(sb2, "call:signal", { callId: invite.callId, data: {} })).ok, false);

    const toA = waitFor(sa, "call:signal");
    await emit(sb1, "call:signal", { callId: invite.callId, data: { candidate: { candidate: "c" } } });
    assert.deepEqual((await toA).data, { candidate: { candidate: "c" } });

    await sleep(250);
    const ended = waitFor(sb1, "call:ended");
    const historyA = historyFor(sa);
    const historyB = historyFor(sb1);
    assert.equal((await emit(sa, "call:end", { callId: invite.callId })).ok, true);
    assert.equal((await ended).reason, "hangup");

    const [ha, hb] = await Promise.all([historyA, historyB]);
    assert.equal(ha._id, hb._id);
    assert.equal(ha.call.kind, "video");
    assert.equal(ha.call.status, "completed");
    assert.ok(ha.call.durationMs >= 200, `duration ${ha.call.durationMs}`);
    assert.equal(ha.senderId, a.id);

    // And it is part of the conversation history.
    const { messages } = await (await api(url, b, `/api/messages/${a.id}`)).json();
    assert.ok(messages.some((m) => m._id === ha._id && m.call?.status === "completed"));

    // The call is gone: both are free again.
    const again = await emit(sa, "call:invite", { to: b.id, kind: "audio" });
    assert.equal(again.ok, true);
    await emit(sa, "call:cancel", { callId: again.callId });
  });

  test("decline: caller told, history says declined", async () => {
    const [a, b] = await friends();
    const sa = await connect(url, a);
    const sb = await connect(url, b);
    const incoming = waitFor(sb, "call:incoming");
    const { callId } = await emit(sa, "call:invite", { to: b.id, kind: "audio" });
    await incoming;
    const ended = waitFor(sa, "call:ended");
    const history = historyFor(sa);
    await emit(sb, "call:reject", { callId });
    assert.equal((await ended).reason, "declined");
    assert.equal((await history).call.status, "declined");
  });

  test("caller cancels while ringing: callee's tabs stop ringing, missed call logged", async () => {
    const [a, b] = await friends();
    const sa = await connect(url, a);
    const sb = await connect(url, b);
    const incoming = waitFor(sb, "call:incoming");
    const { callId } = await emit(sa, "call:invite", { to: b.id, kind: "audio" });
    await incoming;
    const ended = waitFor(sb, "call:ended");
    const history = historyFor(sb);
    assert.equal((await emit(sa, "call:cancel", { callId })).ok, true);
    assert.equal((await ended).reason, "cancelled");
    assert.equal((await history).call.status, "missed");
  });

  test("no answer: ring times out for both, missed call logged", async () => {
    const [a, b] = await friends();
    const sa = await connect(url, a);
    const sb = await connect(url, b);
    const incoming = waitFor(sb, "call:incoming");
    await emit(sa, "call:invite", { to: b.id, kind: "video" });
    await incoming;
    const timeout = RING_TIMEOUT_MS + 1500;
    const [ea, eb, h] = await Promise.all([
      waitFor(sa, "call:ended", { timeout }),
      waitFor(sb, "call:ended", { timeout }),
      waitFor(sb, "newMessage", { timeout, where: (m) => !!m.call }),
    ]);
    assert.equal(ea.reason, "no_answer");
    assert.equal(eb.reason, "no_answer");
    assert.equal(h.call.status, "missed");
  });

  test("offline callee: unavailable, and they still see a missed call", async () => {
    const [a, b] = await friends();
    const sa = await connect(url, a);
    const reply = await emit(sa, "call:invite", { to: b.id, kind: "audio" });
    assert.deepEqual(reply, { ok: false, reason: "unavailable" });
    await sleep(200);
    const { messages } = await (await api(url, b, `/api/messages/${a.id}`)).json();
    assert.ok(messages.some((m) => m.call?.status === "missed"));
  });

  test("busy: a second caller can't ring someone already in a call", async () => {
    const [a, b] = await friends();
    const c = await signup(url, "third");
    await befriend(url, c, b);
    const sa = await connect(url, a);
    const sb = await connect(url, b);
    const sc = await connect(url, c);
    const incoming = waitFor(sb, "call:incoming");
    const { callId } = await emit(sa, "call:invite", { to: b.id, kind: "audio" });
    await incoming;
    await emit(sb, "call:accept", { callId });

    const quiet = staysQuiet(sb, "call:incoming");
    assert.deepEqual(await emit(sc, "call:invite", { to: b.id, kind: "audio" }), {
      ok: false,
      reason: "busy",
    });
    assert.equal(await quiet, true);

    // And someone in a call can't start another.
    assert.equal((await emit(sa, "call:invite", { to: b.id, kind: "audio" })).reason, "already_in_call");
  });

  test("calls need an accepted chat request", async () => {
    const a = await signup(url, "stranger");
    const b = await signup(url, "target");
    const sa = await connect(url, a);
    const sb = await connect(url, b);
    const quiet = staysQuiet(sb, "call:incoming");
    assert.deepEqual(await emit(sa, "call:invite", { to: b.id, kind: "audio" }), {
      ok: false,
      reason: "forbidden",
    });

    // A pending request (a message sent, not yet accepted) isn't enough either.
    await api(url, a, `/api/messages/send/${b.id}`, { method: "POST", body: { message: "hello?" } });
    assert.deepEqual(await emit(sa, "call:invite", { to: b.id, kind: "audio" }), {
      ok: false,
      reason: "forbidden",
    });
    assert.equal(await quiet, true);
  });

  test("outsiders can't touch someone else's call", async () => {
    const [a, b] = await friends();
    const e = await signup(url, "eve");
    const sa = await connect(url, a);
    const sb = await connect(url, b);
    const se = await connect(url, e);
    const incoming = waitFor(sb, "call:incoming");
    const { callId } = await emit(sa, "call:invite", { to: b.id, kind: "audio" });
    await incoming;

    assert.equal((await emit(se, "call:accept", { callId })).ok, false);
    assert.equal((await emit(se, "call:reject", { callId })).ok, false);
    assert.equal((await emit(se, "call:cancel", { callId })).ok, false);

    await emit(sb, "call:accept", { callId });
    assert.equal((await emit(se, "call:signal", { callId, data: {} })).ok, false);
    assert.equal((await emit(se, "call:end", { callId })).ok, false);
    assert.equal((await emit(se, "call:resume", { callId })).ok, false);

    // The callee can't cancel (that's the caller's action), the caller can't reject.
    assert.equal((await emit(sb, "call:cancel", { callId })).ok, false);
    assert.equal((await emit(sa, "call:reject", { callId })).ok, false);
  });

  test("blocking mid-call hangs up both sides", async () => {
    const [a, b] = await friends();
    const sa = await connect(url, a);
    const sb = await connect(url, b);
    const incoming = waitFor(sb, "call:incoming");
    const { callId } = await emit(sa, "call:invite", { to: b.id, kind: "video" });
    await incoming;
    await emit(sb, "call:accept", { callId });

    const ea = waitFor(sa, "call:ended");
    const eb = waitFor(sb, "call:ended");
    const res = await api(url, b, `/api/block/${a.id}`, { method: "POST" });
    assert.equal(res.status, 200);
    assert.equal((await ea).reason, "ended");
    assert.equal((await eb).reason, "ended");

    assert.equal((await emit(sa, "call:invite", { to: b.id, kind: "audio" })).reason, "forbidden");
  });

  test("a dropped socket can resume its call within the grace period", async () => {
    const [a, b] = await friends();
    const sa = await connect(url, a);
    const sb = await connect(url, b);
    const incoming = waitFor(sb, "call:incoming");
    const { callId } = await emit(sa, "call:invite", { to: b.id, kind: "audio" });
    await incoming;
    await emit(sb, "call:accept", { callId });

    const reconnecting = waitFor(sb, "call:peer-reconnecting");
    sa.close();
    await reconnecting;

    // A different tab of the *callee* can't hijack it; the caller's new socket can.
    const sb2 = await connect(url, b);
    assert.equal((await emit(sb2, "call:resume", { callId })).ok, false);

    const sa2Promise = connect(url, a);
    const sa2 = await sa2Promise;
    const reconnected = waitFor(sb, "call:peer-reconnected");
    const resumed = await emit(sa2, "call:resume", { callId });
    assert.equal(resumed.ok, true);
    assert.equal(resumed.call.role, "caller");
    assert.equal(resumed.call.peerId, b.id);
    await reconnected;

    // Signaling now flows to and from the new socket.
    const sig = waitFor(sb, "call:signal");
    assert.equal((await emit(sa2, "call:signal", { callId, data: { n: 1 } })).ok, true);
    assert.deepEqual((await sig).data, { n: 1 });

    // A drop that isn't resumed ends the call once the grace period runs out.
    const ended = waitFor(sb, "call:ended", { timeout: GRACE_MS + 2000 });
    sa2.close();
    assert.equal((await ended).reason, "disconnected");
  });

  test("a reloaded tab is told it has a resumable call", async () => {
    const [a, b] = await friends();
    const sa = await connect(url, a);
    const sb = await connect(url, b);
    const incoming = waitFor(sb, "call:incoming");
    const { callId } = await emit(sa, "call:invite", { to: b.id, kind: "audio" });
    await incoming;
    await emit(sb, "call:accept", { callId });
    sb.close();
    await sleep(100);

    const { io } = await import("socket.io-client");
    const fresh = io(url, {
      transports: ["websocket"],
      extraHeaders: { cookie: b.cookie },
      reconnection: false,
      forceNew: true,
      autoConnect: false,
    });
    const resumable = waitFor(fresh, "call:resumable");
    fresh.connect();
    const info = await resumable;
    assert.equal(info.callId, callId);
    assert.equal(info.role, "callee");
    fresh.close();
  });

  test("invite validation and rate limiting", async () => {
    const [a, b] = await friends();
    const sa = await connect(url, a);
    assert.equal((await emit(sa, "call:invite", { to: b.id, kind: "screen" })).reason, "invalid");
    assert.equal((await emit(sa, "call:invite", { to: "nope", kind: "audio" })).reason, "invalid");
    assert.equal((await emit(sa, "call:invite", { to: a.id, kind: "audio" })).reason, "invalid");
    assert.equal((await emit(sa, "call:invite", null)).reason, "invalid");

    const sb = await connect(url, b);
    const reasons = [];
    for (let i = 0; i < 6; i++) {
      const reply = await emit(sa, "call:invite", { to: b.id, kind: "audio" });
      reasons.push(reply.ok ? "ok" : reply.reason);
      if (reply.ok) await emit(sa, "call:cancel", { callId: reply.callId });
    }
    // The four invalid attempts above don't count: only real invites do.
    assert.deepEqual(reasons, ["ok", "ok", "ok", "ok", "ok", "rate_limited"]);
    sb.close();
  });

  test("oversized signals are dropped", async () => {
    const [a, b] = await friends();
    const sa = await connect(url, a);
    const sb = await connect(url, b);
    const incoming = waitFor(sb, "call:incoming");
    const { callId } = await emit(sa, "call:invite", { to: b.id, kind: "audio" });
    await incoming;
    await emit(sb, "call:accept", { callId });
    const quiet = staysQuiet(sb, "call:signal");
    assert.equal((await emit(sa, "call:signal", { callId, data: "x".repeat(40 * 1024) })).ok, false);
    assert.equal(await quiet, true);
  });

  test("ICE servers endpoint: login required, STUN by default", async () => {
    const a = await signup(url, "ice");
    assert.equal((await fetch(`${url}/api/calls/ice-servers`)).status, 401);
    const res = await api(url, a, "/api/calls/ice-servers");
    assert.equal(res.status, 200);
    const { iceServers } = await res.json();
    assert.ok(iceServers.length > 0);
    assert.ok([iceServers[0].urls].flat().every((u) => u.startsWith("stun:")));
  });
});

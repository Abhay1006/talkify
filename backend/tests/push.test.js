import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import https from "https";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import webpush from "web-push";
import {
  startServer,
  signup,
  befriend,
  connect,
  emit,
  sleep,
  closeAllSockets,
  api,
  skipWithoutMongo,
} from "./helpers.js";

describe("push notifications", { skip: skipWithoutMongo }, () => {
  // A stand-in browser push service: an HTTPS server that records what the app
  // sends it. web-push only speaks HTTPS, so it gets a throwaway certificate.
  let pushService;
  let pushBase;
  let server;
  let url;
  let tmpDir;
  const received = [];

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talkify-push-"));
    const key = path.join(tmpDir, "key.pem");
    const cert = path.join(tmpDir, "cert.pem");
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        key,
        "-out",
        cert,
        "-days",
        "1",
        "-subj",
        "/CN=127.0.0.1",
        "-addext",
        "subjectAltName=IP:127.0.0.1",
      ],
      { stdio: "ignore" }
    );

    pushService = https.createServer(
      { key: fs.readFileSync(key), cert: fs.readFileSync(cert) },
      (req, res) => {
        let size = 0;
        req.on("data", (c) => {
          size += c.length;
        });
        req.on("end", () => {
          received.push({ path: req.url, headers: req.headers, size });
          res.writeHead(req.url.includes("gone") ? 410 : 201);
          res.end();
        });
      }
    );
    await new Promise((r) => pushService.listen(0, "127.0.0.1", r));
    pushBase = `https://127.0.0.1:${pushService.address().port}/push/`;

    const vapid = webpush.generateVAPIDKeys();
    server = await startServer({
      VAPID_PUBLIC_KEY: vapid.publicKey,
      VAPID_PRIVATE_KEY: vapid.privateKey,
      VAPID_SUBJECT: "mailto:test@example.com",
      PUSH_TEST_ENDPOINT_PREFIX: pushBase,
      NODE_EXTRA_CA_CERTS: cert,
    });
    url = server.url;
  });

  after(async () => {
    closeAllSockets();
    await server?.stop();
    pushService?.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  afterEach(() => closeAllSockets());

  // A subscription as a browser would produce it: a real P-256 key and auth secret.
  const fakeSubscription = (name) => {
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.generateKeys();
    return {
      endpoint: `${pushBase}${name}`,
      keys: { p256dh: ecdh.getPublicKey("base64url"), auth: crypto.randomBytes(16).toString("base64url") },
    };
  };

  const subscribe = (user, subscription) =>
    api(url, user, "/api/push/subscribe", { method: "POST", body: { subscription } });
  const pushesTo = (name) => received.filter((r) => r.path === `/push/${name}`);

  test("push config is exposed to logged-in users", async () => {
    const a = await signup(url, "cfg");
    const cfg = await (await api(url, a, "/api/push/config")).json();
    assert.equal(cfg.enabled, true);
    assert.ok(cfg.publicKey.length > 40);
  });

  test("only real push services are accepted as endpoints (no SSRF)", async () => {
    const a = await signup(url, "ssrf");
    for (const endpoint of [
      "https://evil.example.com/collect",
      "http://fcm.googleapis.com/fcm/send/x",
      "https://fcm.googleapis.com.evil.com/x",
      "https://169.254.169.254/latest",
      "https://fcm.googleapis.com:8443/x",
    ]) {
      const res = await subscribe(a, { ...fakeSubscription("x"), endpoint });
      assert.equal(res.status, 400, endpoint);
    }
    const ok = await subscribe(a, {
      ...fakeSubscription("x"),
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    });
    assert.equal(ok.status, 201);
    assert.equal((await subscribe(a, { endpoint: `${pushBase}y`, keys: { p256dh: 5 } })).status, 400);
  });

  test("offline recipients get a push; online or muted ones don't", async () => {
    const a = await signup(url, "sender");
    const b = await signup(url, "recipient");
    await befriend(url, a, b);
    assert.equal((await subscribe(b, fakeSubscription("bob"))).status, 201);
    received.length = 0;

    // Offline: pushed, encrypted, VAPID-signed.
    await api(url, a, `/api/messages/send/${b.id}`, { method: "POST", body: { message: "you there?" } });
    await sleep(800);
    const [push] = pushesTo("bob");
    assert.ok(push, "push delivered");
    assert.equal(push.headers["content-encoding"], "aes128gcm");
    assert.match(push.headers.authorization, /^vapid t=/);
    assert.ok(push.size > 0);

    // Online: the open tab shows it, no push.
    const sb = await connect(url, b);
    received.length = 0;
    await api(url, a, `/api/messages/send/${b.id}`, { method: "POST", body: { message: "now?" } });
    await sleep(800);
    assert.equal(pushesTo("bob").length, 0);
    sb.close();
    await sleep(200);

    // Muted: no push even when offline.
    await api(url, b, `/api/users/prefs/${a.id}`, { method: "PUT", body: { muted: true } });
    received.length = 0;
    await api(url, a, `/api/messages/send/${b.id}`, { method: "POST", body: { message: "hello??" } });
    await sleep(800);
    assert.equal(pushesTo("bob").length, 0);
  });

  test("a missed call to someone offline is pushed", async () => {
    const a = await signup(url, "caller");
    const b = await signup(url, "away");
    await befriend(url, a, b);
    await subscribe(b, fakeSubscription("away"));
    received.length = 0;
    const sa = await connect(url, a);
    assert.equal((await emit(sa, "call:invite", { to: b.id, kind: "video" })).reason, "unavailable");
    await sleep(800);
    assert.equal(pushesTo("away").length, 1);
    assert.equal(pushesTo("away")[0].headers.urgency, "high");
  });

  test("subscriptions the push service reports gone are forgotten", async () => {
    const a = await signup(url, "s1");
    const b = await signup(url, "s2");
    await befriend(url, a, b);
    await subscribe(b, fakeSubscription("gone"));
    received.length = 0;
    await api(url, a, `/api/messages/send/${b.id}`, { method: "POST", body: { message: "1" } });
    await sleep(800);
    assert.equal(pushesTo("gone").length, 1);
    await api(url, a, `/api/messages/send/${b.id}`, { method: "POST", body: { message: "2" } });
    await sleep(800);
    assert.equal(pushesTo("gone").length, 1, "not retried after 410");
  });

  test("unsubscribe stops pushes", async () => {
    const a = await signup(url, "u1");
    const b = await signup(url, "u2");
    await befriend(url, a, b);
    const sub = fakeSubscription("leaving");
    await subscribe(b, sub);
    await api(url, b, "/api/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } });
    received.length = 0;
    await api(url, a, `/api/messages/send/${b.id}`, { method: "POST", body: { message: "bye" } });
    await sleep(800);
    assert.equal(pushesTo("leaving").length, 0);
  });
});

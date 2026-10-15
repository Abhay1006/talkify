import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import sharp from "sharp";
import {
  startServer, signup, befriend, connect, emit, waitFor, staysQuiet, sleep, closeAllSockets, api,
} from "./helpers.js";

const EDIT_WINDOW_MS = 2500;

let server;
let url;
let site; // a local "website" for link previews
let siteUrl;

before(async () => {
  site = http.createServer((req, res) => {
    if (req.url === "/article") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><html><head>
        <meta content="Tom &amp; Jerry&#39;s guide" property="og:title">
        <meta property="og:description" content="Everything about   cats and mice.">
        <meta property="og:site_name" content="Example News">
        <title>ignored</title></head><body>hi</body></html>`);
    } else if (req.url === "/plain") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><head><title> Just a title </title></head></html>");
    } else if (req.url === "/hop") {
      res.writeHead(302, { location: "/article" });
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => site.listen(0, "127.0.0.1", r));
  siteUrl = `http://127.0.0.1:${site.address().port}`;

  server = await startServer({ MESSAGE_EDIT_WINDOW_MS: String(EDIT_WINDOW_MS), LINK_PREVIEW_ALLOW_PRIVATE: "1" });
  url = server.url;
});

after(async () => {
  closeAllSockets();
  await server?.stop();
  site?.close();
});

afterEach(() => closeAllSockets());

const send = async (from, to, message) => (await api(url, from, `/api/messages/send/${to.id}`, { method: "POST", body: { message } })).json();
const edit = (who, id, message) => api(url, who, `/api/messages/${id}`, { method: "PATCH", body: { message } });

test("edit: own text messages, within the window, pushed live to both", async () => {
  const a = await signup(url, "editor");
  const b = await signup(url, "reader");
  await befriend(url, a, b);
  const sb = await connect(url, b);
  const msg = await send(a, b, "teh typo");

  const updated = waitFor(sb, "messageUpdated", { where: (m) => m._id === msg._id });
  const res = await edit(a, msg._id, "  the typo  ");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.body, "the typo");
  assert.ok(body.editedAt);
  assert.equal((await updated).body, "the typo");

  assert.equal((await edit(b, msg._id, "hijack")).status, 404, "can't edit someone else's");
  assert.equal((await edit(a, msg._id, "   ")).status, 400);
  assert.equal((await edit(a, "000000000000000000000000", "x")).status, 404);
  assert.equal((await edit(a, "nope", "x")).status, 404);

  await sleep(EDIT_WINDOW_MS + 300);
  assert.equal((await edit(a, msg._id, "too late")).status, 403);
});

test("link previews: fetched after sending, pushed as an update", async () => {
  const a = await signup(url, "linker");
  const b = await signup(url, "clicker");
  await befriend(url, a, b);
  const sb = await connect(url, b);

  const updated = waitFor(sb, "messageUpdated", { timeout: 8000, where: (m) => !!m.linkPreview });
  const msg = await send(a, b, `look at this: ${siteUrl}/hop.`);
  const preview = (await updated).linkPreview;
  assert.equal(updated && (await updated)._id, msg._id);
  assert.equal(preview.url, `${siteUrl}/hop`, "trailing punctuation trimmed");
  assert.equal(preview.title, "Tom & Jerry's guide");
  assert.equal(preview.description, "Everything about cats and mice.");
  assert.equal(preview.siteName, "Example News");

  // Editing the link away removes the card.
  const cleared = waitFor(sb, "messageUpdated", { timeout: 8000, where: (m) => m._id === msg._id && !m.linkPreview && m.editedAt });
  await edit(a, msg._id, "never mind");
  await cleared;

  // A page with only <title> still gets a card; a 404 gets none.
  const plain = waitFor(sb, "messageUpdated", { timeout: 8000, where: (m) => m.linkPreview?.title === "Just a title" });
  await send(a, b, `${siteUrl}/plain`);
  await plain;
  const quiet = staysQuiet(sb, "messageUpdated", 1500);
  await send(a, b, `${siteUrl}/missing`);
  assert.equal(await quiet, true);
});

test("voice messages: format sniffing, limits, range requests, access control", async () => {
  const a = await signup(url, "talker");
  const b = await signup(url, "listener");
  const e = await signup(url, "eaves");
  await befriend(url, a, b);

  // Smallest thing that looks like a WebM file to the sniffer.
  const webm = Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84]),
    Buffer.from("webm"),
    Buffer.alloc(5000, 7),
  ]);
  const sendVoice = (buf, { durationMs = 4200, waveform = JSON.stringify([0.1, 0.5, 2, -1, "x"]), type = "audio/webm" } = {}) => {
    const form = new FormData();
    form.append("audio", new Blob([buf], { type }), "voice.webm");
    form.append("durationMs", String(durationMs));
    form.append("waveform", waveform);
    return fetch(`${url}/api/messages/send/${b.id}/voice`, { method: "POST", headers: { cookie: a.cookie }, body: form });
  };

  const res = await sendVoice(webm);
  assert.equal(res.status, 201);
  const msg = await res.json();
  assert.equal(msg.voice.contentType, "audio/webm");
  assert.equal(msg.voice.durationMs, 4200);
  assert.deepEqual(msg.voice.waveform, [0.1, 0.5, 1, 0, 0], "levels clamped to 0..1");

  const full = await api(url, b, `/api/media/${msg.voice.mediaId}`);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("content-type"), "audio/webm");
  assert.equal(full.headers.get("accept-ranges"), "bytes");
  assert.match(full.headers.get("content-security-policy"), /sandbox/);
  assert.equal((await full.arrayBuffer()).byteLength, webm.length);

  const part = await fetch(`${url}/api/media/${msg.voice.mediaId}`, { headers: { cookie: b.cookie, range: "bytes=0-99" } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get("content-range"), `bytes 0-99/${webm.length}`);
  const partBody = Buffer.from(await part.arrayBuffer());
  assert.equal(partBody.length, 100);
  assert.ok(partBody.equals(webm.subarray(0, 100)));

  const tail = await fetch(`${url}/api/media/${msg.voice.mediaId}`, { headers: { cookie: b.cookie, range: "bytes=-10" } });
  assert.equal(tail.status, 206);
  assert.ok(Buffer.from(await tail.arrayBuffer()).equals(webm.subarray(-10)));

  const bad = await fetch(`${url}/api/media/${msg.voice.mediaId}`, { headers: { cookie: b.cookie, range: "bytes=999999-" } });
  assert.equal(bad.status, 416);

  assert.equal((await api(url, e, `/api/media/${msg.voice.mediaId}`)).status, 404, "outsiders can't listen");

  // A WAV, or HTML labelled audio/webm, is refused by content.
  const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt "), Buffer.alloc(200)]);
  assert.equal((await sendVoice(wav)).status, 415);
  assert.equal((await sendVoice(Buffer.from("<html><script>alert(1)</script></html>".padEnd(200)))).status, 415);
  // Matroska video isn't WebM audio.
  const mkv = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from("matroska"), Buffer.alloc(200)]);
  assert.equal((await sendVoice(mkv)).status, 415);

  assert.equal((await sendVoice(webm, { durationMs: 100 })).status, 400);
  assert.equal((await sendVoice(webm, { durationMs: 6 * 60 * 1000 })).status, 400);
  assert.equal((await sendVoice(webm, { durationMs: "abc" })).status, 400);

  const tooBig = Buffer.concat([webm, Buffer.alloc(3 * 1024 * 1024)]);
  assert.equal((await sendVoice(tooBig)).status, 413);

  // Voice notes can't be edited into text.
  assert.equal((await edit(a, msg._id, "text now")).status, 400);
});

test("profile: name, bio and a public avatar", async () => {
  const a = await signup(url, "profiled");
  const stranger = await signup(url, "stranger");

  let res = await api(url, a, "/api/users/me", { method: "PUT", body: { fullName: "  New Name ", bio: "Hello there" } });
  assert.equal(res.status, 200);
  let me = await res.json();
  assert.equal(me.fullName, "New Name");
  assert.equal(me.bio, "Hello there");
  assert.equal(me.password, undefined);

  assert.equal((await api(url, a, "/api/users/me", { method: "PUT", body: { fullName: "" } })).status, 400);
  assert.equal((await api(url, a, "/api/users/me", { method: "PUT", body: { fullName: "x".repeat(51) } })).status, 400);
  assert.equal((await api(url, a, "/api/users/me", { method: "PUT", body: { bio: "x".repeat(161) } })).status, 400);

  const photo = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#c63" } })
    .jpeg().withMetadata({ exif: { IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1" } } }).toBuffer();
  const upload = (buf) => {
    const form = new FormData();
    form.append("image", new Blob([buf], { type: "image/jpeg" }), "me.jpg");
    return fetch(`${url}/api/users/me/avatar`, { method: "POST", headers: { cookie: a.cookie }, body: form });
  };
  res = await upload(photo);
  assert.equal(res.status, 200);
  me = await res.json();
  assert.match(me.profilePic, /^\/api\/media\/[a-f0-9]{24}$/);

  // Anyone logged in can see a profile picture; it's square and EXIF-free.
  const pic = await api(url, stranger, me.profilePic);
  assert.equal(pic.status, 200);
  const meta = await sharp(Buffer.from(await pic.arrayBuffer())).metadata();
  assert.equal(meta.width, 256);
  assert.equal(meta.height, 256);
  assert.equal(meta.exif, undefined);
  assert.equal((await fetch(`${url}${me.profilePic}`)).status, 401, "but not anonymously");

  // Replacing it deletes the old one.
  const oldPic = me.profilePic;
  me = await (await upload(photo)).json();
  assert.notEqual(me.profilePic, oldPic);
  assert.equal((await api(url, a, oldPic)).status, 404);

  assert.equal((await upload(Buffer.from("not an image"))).status, 415);
  assert.equal((await (await api(url, a, "/api/users/me")).json()).fullName, "New Name");
});

test("pin, mute, archive: per user, shown in the contact list", async () => {
  const a = await signup(url, "organiser");
  const b = await signup(url, "friend");
  await befriend(url, a, b);

  const res = await api(url, a, `/api/users/prefs/${b.id}`, { method: "PUT", body: { pinned: true, muted: true } });
  assert.equal(res.status, 200);
  let contacts = await (await api(url, a, "/api/users")).json();
  let row = contacts.find((c) => c._id === b.id);
  assert.deepEqual([row.pinned, row.muted, row.archived], [true, true, false]);

  await api(url, a, `/api/users/prefs/${b.id}`, { method: "PUT", body: { archived: true, pinned: false } });
  contacts = await (await api(url, a, "/api/users")).json();
  row = contacts.find((c) => c._id === b.id);
  assert.deepEqual([row.pinned, row.muted, row.archived], [false, true, true], "unspecified flags kept");

  // Private to the person who set them.
  const theirs = (await (await api(url, b, "/api/users")).json()).find((c) => c._id === a.id);
  assert.deepEqual([theirs.pinned, theirs.muted, theirs.archived], [false, false, false]);

  assert.equal((await api(url, a, `/api/users/prefs/${b.id}`, { method: "PUT", body: { pinned: "yes" } })).status, 400);
  assert.equal((await api(url, a, `/api/users/prefs/${b.id}`, { method: "PUT", body: {} })).status, 400);
  assert.equal((await api(url, a, `/api/users/prefs/${a.id}`, { method: "PUT", body: { pinned: true } })).status, 400);
});

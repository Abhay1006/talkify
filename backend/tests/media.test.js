import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { startServer, signup, api } from "./helpers.js";

let server;
let url;

before(async () => {
  server = await startServer();
  url = server.url;
});
after(() => server?.stop());

const sendImage = (from, to, buf, { caption, type = "image/jpeg", name = "x.jpg", field = "image" } = {}) => {
  const form = new FormData();
  form.append(field, new Blob([buf], { type }), name);
  if (caption !== undefined) form.append("caption", caption);
  return fetch(`${url}/api/messages/send/${to.id}/image`, { method: "POST", headers: { cookie: from.cookie }, body: form });
};

const getMedia = (who, id, headers = {}) =>
  fetch(`${url}/api/media/${id}`, { headers: { ...(who ? { cookie: who.cookie } : {}), ...headers } });

// A 3000x2000 JPEG tagged "rotate 90°" with GPS coordinates in its EXIF.
const phonePhoto = () =>
  sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#3a6" } })
    .jpeg()
    .withMetadata({ orientation: 6, exif: { IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1" } } })
    .toBuffer();

test("image messages: processing, privacy and access control", async () => {
  const alice = await signup(url, "alice");
  const bob = await signup(url, "bob");
  const eve = await signup(url, "eve");
  const photo = await phonePhoto();

  const res = await sendImage(alice, bob, photo, { caption: "  hello pic  " });
  assert.equal(res.status, 201);
  const msg = await res.json();
  assert.equal(msg.body, "hello pic");
  assert.equal(msg.image.width, 1067, "rotated upright and capped at 1600px");
  assert.equal(msg.image.height, 1600);
  assert.match(msg.image.placeholder, /^data:image\/webp;base64,/);

  const full = await getMedia(bob, msg.image.fullId);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("content-type"), "image/webp");
  assert.match(full.headers.get("cache-control"), /private/);
  assert.equal(full.headers.get("x-content-type-options"), "nosniff");
  const meta = await sharp(Buffer.from(await full.arrayBuffer())).metadata();
  assert.equal(meta.exif, undefined, "EXIF (and GPS) stripped");

  assert.equal((await getMedia(bob, msg.image.fullId, { "if-none-match": full.headers.get("etag") })).status, 304);

  const thumb = await getMedia(alice, msg.image.thumbId);
  const tm = await sharp(Buffer.from(await thumb.arrayBuffer())).metadata();
  assert.equal(Math.max(tm.width, tm.height), 400);

  assert.equal((await getMedia(eve, msg.image.fullId)).status, 404, "outsiders get 404");
  assert.equal((await getMedia(null, msg.image.fullId)).status, 401);
  assert.equal((await getMedia(bob, "000000000000000000000000")).status, 404);
  assert.equal((await getMedia(bob, "not-an-id")).status, 404);

  // Blocking cuts off the images too.
  await api(url, bob, `/api/block/${alice.id}`, { method: "POST" });
  assert.equal((await getMedia(alice, msg.image.fullId)).status, 404);
  assert.equal((await sendImage(alice, bob, photo)).status, 403);
});

test("image messages: rejects what isn't a safe image", async () => {
  const alice = await signup(url, "alice");
  const bob = await signup(url, "bob");
  const photo = await phonePhoto();

  const html = await sendImage(alice, bob, Buffer.from("<html><script>alert(1)</script></html>"), { type: "image/png", name: "evil.png" });
  assert.equal(html.status, 415);
  const svg = await sendImage(alice, bob, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9"/>'), { type: "image/png" });
  assert.equal(svg.status, 415);
  assert.equal((await sendImage(alice, bob, Buffer.alloc(2 * 1024 * 1024 + 10, 1))).status, 413);
  assert.equal((await sendImage(alice, bob, photo, { field: "file" })).status, 400);
  assert.equal((await sendImage(alice, alice, photo)).status, 400);
  assert.equal((await sendImage(alice, bob, photo, { caption: "x".repeat(4001) })).status, 400);
});

test("image messages: GIFs stay animated", async () => {
  const alice = await signup(url, "alice");
  const bob = await signup(url, "bob");
  const frame = (c) => sharp({ create: { width: 300, height: 200, channels: 4, background: c } }).png().toBuffer();
  const gif = await sharp([await frame("#f00"), await frame("#0f0")], { join: { animated: true } }).gif().toBuffer();

  const res = await sendImage(bob, alice, gif, { type: "image/gif", name: "a.gif" });
  assert.equal(res.status, 201);
  const msg = await res.json();
  assert.equal(msg.image.animated, true);
  assert.equal(msg.body, undefined);
  const served = Buffer.from(await (await getMedia(alice, msg.image.fullId)).arrayBuffer());
  assert.equal((await sharp(served, { animated: true }).metadata()).pages, 2);
});

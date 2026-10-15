// Unit tests for the SSRF guard, run in-process WITHOUT the test-only
// private-address allowance: these must all be refused for real.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import { isPublicAddress, fetchLinkPreview, parsePreview, firstUrl } from "../utils/linkPreview.js";

let site;
let port;
const hits = [];

before(async () => {
  site = http.createServer((req, res) => {
    hits.push(req.url);
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<title>internal admin panel</title>");
  });
  await new Promise((r) => site.listen(0, "127.0.0.1", r));
  port = site.address().port;
});
after(() => site.close());

test("private, loopback, link-local and reserved addresses are not public", () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "198.18.0.1",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "64:ff9b::a00:1",
  ]) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(isPublicAddress(ip), true, ip);
  }
  assert.equal(isPublicAddress("not-an-ip"), false);
});

test("internal targets are refused before any request is made", async () => {
  const targets = [
    `http://127.0.0.1:${port}/`,
    `http://127.0.0.1/`,
    `http://localhost:${port}/`,
    // Trailing dot dodges a naive hostname check; the DNS-level guard catches it.
    `http://localhost./`,
    `http://[::1]:${port}/`,
    `http://0x7f000001/`,
    `http://2130706433/`,
    "http://169.254.169.254/latest/meta-data/",
    "http://metadata.google.internal/",
    "ftp://example.com/",
    "file:///etc/passwd",
    "http://user:pass@example.com/",
    "http://example.com:8080/",
    "javascript:alert(1)",
  ];
  for (const target of targets) {
    assert.equal(await fetchLinkPreview(target), null, target);
  }
  assert.deepEqual(hits, [], "the internal server was never contacted");
});

test("parses OpenGraph, Twitter and plain HTML", () => {
  assert.deepEqual(
    parsePreview(
      `<meta name="twitter:title" content='Single &quot;quoted&quot;'><meta name="description" content="Plain desc">`
    ),
    { title: 'Single "quoted"', description: "Plain desc", siteName: undefined }
  );
  assert.equal(parsePreview("<html><body>no title</body></html>"), null);
  const long = parsePreview(`<title>${"a".repeat(500)}</title>`);
  assert.equal(long.title.length, 200);
  assert.ok(long.title.endsWith("…"));
});

test("finds the first link in a message", () => {
  assert.equal(firstUrl("see https://example.com/a?b=1, then http://other.com"), "https://example.com/a?b=1");
  assert.equal(firstUrl("(https://example.com/path)."), "https://example.com/path");
  assert.equal(firstUrl("no links here, example.com"), null);
  assert.equal(firstUrl(undefined), null);
});

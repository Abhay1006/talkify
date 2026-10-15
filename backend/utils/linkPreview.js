import dns from "dns";
import http from "http";
import https from "https";
import net from "net";

// Server-side link previews, built to resist SSRF (docs/V2-REDESIGN.md §7).
//
// A server that fetches user-supplied URLs can be aimed at things only it can
// reach: cloud metadata (169.254.169.254), localhost, the private network.
// Defences, in order:
// - http/https on the default ports only, no credentials in the URL.
// - The hostname is resolved by OUR lookup function, which rejects any
//   private, loopback, link-local, multicast or reserved address — and the
//   connection is made to exactly the address that was checked. Validating in
//   the socket's own lookup (rather than resolving first and fetching later)
//   closes the DNS-rebinding gap.
// - Every redirect hop goes through the same checks; at most 3 of them.
// - Hard limits: 5 s overall, 256 KB read, HTML only.

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5000;
const MAX_BYTES = 256 * 1024;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 500;
const USER_AGENT = "TalkifyLinkPreview/1.0 (+https://talkify-etjd.onrender.com)";

// Tests point previews at a local server. Never honoured outside NODE_ENV=test.
const allowPrivateForTests =
  process.env.NODE_ENV === "test" && process.env.LINK_PREVIEW_ALLOW_PRIVATE === "1";

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
]) {
  blocked.addSubnet(addr, prefix, "ipv4");
}
for (const [addr, prefix] of [
  // ::ffff:0:0/96 (IPv4-mapped) is deliberately absent: net.BlockList would
  // treat it as covering every IPv4 address. Mapped addresses are unwrapped
  // and checked as IPv4 in isPublicAddress instead.
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64],
  ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
]) {
  blocked.addSubnet(addr, prefix, "ipv6");
}

/** True only for addresses on the public internet. */
export const isPublicAddress = (address) => {
  const family = net.isIP(address);
  if (!family) return false;
  if (family === 6) {
    const mapped = /^::ffff:(?:0:)?(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return isPublicAddress(mapped[1]);
    // Hex form of a mapped address, e.g. ::ffff:7f00:1
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address);
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      return isPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
  }
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
};

// Resolves like dns.lookup, but refuses to hand back a non-public address.
const guardedLookup = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: options.family }];
    // Reject if ANY answer is private: a mixed answer is a rebinding attempt.
    if (!allowPrivateForTests && list.some((a) => !isPublicAddress(a.address))) {
      return callback(Object.assign(new Error("Blocked address"), { code: "EBLOCKED" }));
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

const checkUrl = (raw) => {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.port && !["80", "443"].includes(url.port) && !allowPrivateForTests) return null;
  // Literal IPs skip DNS, so check them here.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && !isPublicAddress(host) && !allowPrivateForTests) return null;
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host) && !allowPrivateForTests) return null;
  return url;
};

const fetchOnce = (url, deadline) =>
  new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml",
          "accept-encoding": "identity",
          "accept-language": "en",
        },
        timeout: Math.max(1, deadline - Date.now()),
        // Never reuse a connection: each request must go through the lookup.
        agent: false,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve({ redirect: new URL(res.headers.location, url).toString() });
        }
        if (res.statusCode !== 200 || !/text\/html|application\/xhtml/i.test(res.headers["content-type"] ?? "")) {
          res.resume();
          return resolve(null);
        }
        let size = 0;
        const chunks = [];
        res.on("data", (chunk) => {
          size += chunk.length;
          chunks.push(chunk);
          if (size >= MAX_BYTES) res.destroy();
        });
        const done = () => resolve({ html: Buffer.concat(chunks).toString("utf8").slice(0, MAX_BYTES) });
        res.on("end", done);
        res.on("close", done);
        res.on("error", done);
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decodeEntities = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

const clean = (s, max) => {
  if (!s) return undefined;
  const text = decodeEntities(s).replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/** Pulls title/description/site name out of OpenGraph, Twitter or plain tags. */
export const parsePreview = (html) => {
  const meta = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attr = (name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
    const key = (attr("property") ?? attr("name"))?.slice(2).find((v) => v !== undefined)?.toLowerCase();
    const content = attr("content")?.slice(2).find((v) => v !== undefined);
    if (key && content !== undefined && !(key in meta)) meta[key] = content;
  }
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  const title = clean(meta["og:title"] ?? meta["twitter:title"] ?? titleTag, 200);
  if (!title) return null;
  return {
    title,
    description: clean(meta["og:description"] ?? meta["twitter:description"] ?? meta.description, 300),
    siteName: clean(meta["og:site_name"], 80),
  };
};

const cache = new Map();

const remember = (url, value) => {
  cache.delete(url);
  cache.set(url, { value, at: Date.now() });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return value;
};

/**
 * Resolves to { url, title, description, siteName } or null. Never throws:
 * a preview is decoration, and any failure just means no card.
 */
export const fetchLinkPreview = async (rawUrl) => {
  const hit = cache.get(rawUrl);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const deadline = Date.now() + TIMEOUT_MS;
  let current = rawUrl;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const url = checkUrl(current);
      if (!url || Date.now() >= deadline) return remember(rawUrl, null);
      const result = await fetchOnce(url, deadline);
      if (!result) return remember(rawUrl, null);
      if (result.redirect) {
        current = result.redirect;
        continue;
      }
      const preview = parsePreview(result.html);
      return remember(rawUrl, preview && { url: rawUrl, ...preview });
    }
  } catch {
    // Blocked address, DNS failure, timeout, reset: no preview.
  }
  return remember(rawUrl, null);
};

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/i;

/** The first http(s) URL in a message, minus trailing punctuation. */
export const firstUrl = (text) => {
  const match = typeof text === "string" ? text.match(URL_PATTERN) : null;
  if (!match) return null;
  const url = match[0].replace(/[.,;:!?)\]}'"]+$/, "");
  return url.length <= 2048 ? url : null;
};

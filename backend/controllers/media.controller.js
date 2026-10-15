import mediaStorage from "../storage/mediaStorage.js";
import { isBlockedBetween } from "../utils/relationships.js";

// Parses a single "bytes=start-end" range. Returns null for anything else
// (multi-range requests just get the whole file).
const parseRange = (header, length) => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? "");
  if (!match || (match[1] === "" && match[2] === "")) return null;
  let start;
  let end;
  if (match[1] === "") {
    // Suffix range: the last N bytes.
    start = Math.max(0, length - Number(match[2]));
    end = length - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? length - 1 : Math.min(Number(match[2]), length - 1);
  }
  if (start > end || start >= length) return "unsatisfiable";
  return { start, end };
};

// A private photo or voice note in a private chat must not be readable by
// anyone who happens to have the link. Every read is checked against the
// participants recorded at upload time. See docs/V2-REDESIGN.md §6.3.
// Profile pictures are the exception: marked public, readable by any
// logged-in user, like the names they sit next to.
export const getMedia = async (req, res) => {
  const { id } = req.params;
  const me = req.user._id.toString();

  const object = await mediaStorage.getObject(id);
  if (!object) return res.status(404).json({ error: "Not found" });

  if (!object.metadata.public) {
    // 404 rather than 403 for someone else's media, so ids can't be probed
    // for existence.
    const participants = (object.metadata.participants ?? []).map(String);
    if (!participants.includes(me)) {
      return res.status(404).json({ error: "Not found" });
    }

    // Blocking cuts off the conversation's history, media included, the
    // same way getMessages does.
    const other = participants.find((p) => p !== me);
    if (!other || (await isBlockedBetween(me, other))) {
      return res.status(404).json({ error: "Not found" });
    }
  }

  // Stored objects are immutable, so the id is a valid validator.
  const etag = `"${object.id}"`;
  res.set({
    "Cache-Control": "private, max-age=86400",
    ETag: etag,
    "Accept-Ranges": "bytes",
    // Even if a crafted file got past the type checks, opening it directly
    // can't run script or load anything.
    "Content-Security-Policy":
      "default-src 'none'; media-src 'self'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  });
  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }

  res.set({ "Content-Type": object.contentType, "Content-Disposition": "inline" });

  // Safari won't play audio from a server that ignores Range requests.
  const range = parseRange(req.headers.range, object.length);
  if (range === "unsatisfiable") {
    res.set("Content-Range", `bytes */${object.length}`);
    return res.status(416).end();
  }

  let stream;
  if (range) {
    res.status(206).set({
      "Content-Range": `bytes ${range.start}-${range.end}/${object.length}`,
      "Content-Length": range.end - range.start + 1,
    });
    stream = object.openStream({ start: range.start, end: range.end + 1 });
  } else {
    res.set("Content-Length", object.length);
    stream = object.openStream();
  }

  stream.once("error", (error) => {
    console.error("Error streaming media", error);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
    else res.destroy(error);
  });
  stream.pipe(res);
};

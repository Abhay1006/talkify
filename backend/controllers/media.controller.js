import mediaStorage from "../storage/mediaStorage.js";
import { checkCanMessage } from "../utils/messagePermissions.js";

// A private photo in a private chat must not be readable by anyone who
// happens to have the link. Every read is checked against the participants
// recorded when the image was uploaded. See docs/V2-REDESIGN.md §6.3.
export const getMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const me = req.user._id.toString();

    const object = await mediaStorage.getObject(id);

    // 404 rather than 403 for someone else's media, so ids can't be probed
    // for existence.
    const participants = (object?.metadata.participants ?? []).map(String);
    if (!object || !participants.includes(me)) {
      return res.status(404).json({ error: "Not found" });
    }

    // Blocking cuts off the conversation's history, images included, the same
    // way getMessages does.
    const other = participants.find((p) => p !== me);
    const permission = await checkCanMessage(me, other);
    if (!permission.ok) {
      return res.status(404).json({ error: "Not found" });
    }

    // Stored objects are immutable, so the id is a valid validator.
    const etag = `"${object.id}"`;
    res.set({
      "Cache-Control": "private, max-age=86400",
      ETag: etag,
    });
    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    res.set({
      "Content-Type": object.contentType,
      "Content-Length": object.length,
      "Content-Disposition": "inline",
    });

    const stream = object.openStream();
    stream.once("error", (error) => {
      console.error("Error streaming media", error);
      if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) {
    console.error("Error in getMedia", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

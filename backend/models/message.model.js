import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Message text. This was previously named `ciphertext` alongside `iv` and
    // `senderPublicKey`, but nothing in the app ever encrypted anything — the
    // field held plaintext under a name that claimed otherwise. Renamed so the
    // schema describes what it actually stores. See docs/V2-REDESIGN.md §3.2.
    // Optional when the message carries an image (it is then the caption).
    // A message must have a body, an image, or both — enforced below.
    body: {
      type: String,
    },

    // Image attachment. The bytes live in media storage
    // (backend/storage/mediaStorage.js) and are only readable through
    // GET /api/media/:id, which checks the reader is in this conversation.
    image: {
      type: new mongoose.Schema(
        {
          fullId: { type: mongoose.Schema.Types.ObjectId, required: true },
          thumbId: { type: mongoose.Schema.Types.ObjectId, required: true },
          contentType: { type: String, required: true },
          width: { type: Number, required: true },
          height: { type: Number, required: true },
          animated: { type: Boolean, default: false },
          // Tiny inline data URI, shown blurred while the thumbnail loads.
          placeholder: { type: String },
        },
        { _id: false }
      ),
      default: undefined,
    },

    // Call history line ("Voice call · 2:31", "Missed video call"). Written
    // only by the server (backend/socket/calls.js), never from client input.
    call: {
      type: new mongoose.Schema(
        {
          kind: { type: String, enum: ["audio", "video"], required: true },
          status: { type: String, enum: ["completed", "missed", "declined"], required: true },
          durationMs: { type: Number, default: 0 },
        },
        { _id: false }
      ),
      default: undefined,
    },

    // Legacy field, retained only so messages written before the rename remain
    // readable until scripts/migrate-message-body.js has run. Never written to.
    ciphertext: {
      type: String,
      select: true,
    },
  },
  { timestamps: true }
);

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });

messageSchema.pre("validate", function (next) {
  const hasBody = typeof this.body === "string" && this.body.length > 0;
  if (!hasBody && !this.image && !this.call && this.ciphertext == null) {
    this.invalidate("body", "A message needs text, an image or a call");
  }
  next();
});

// Old documents have `ciphertext` and no `body`. Fall back so a partially
// migrated database still renders every message correctly.
messageSchema.set("toJSON", {
  transform: (_doc, ret) => {
    if (ret.body == null && ret.ciphertext != null) ret.body = ret.ciphertext;
    delete ret.ciphertext;
    return ret;
  },
});

const Message = mongoose.model("Message", messageSchema);

export default Message;

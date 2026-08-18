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
    body: {
      type: String,
      required: true,
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

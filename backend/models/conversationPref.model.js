import mongoose from "mongoose";

// One user's settings for one chat: pinned to the top, muted (no sound or push
// notifications), archived (hidden from the main list). Per user, so muting
// someone is invisible to them.
const conversationPrefSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pinned: { type: Boolean, default: false },
    muted: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

conversationPrefSchema.index({ userId: 1, partnerId: 1 }, { unique: true });

const ConversationPref = mongoose.model("ConversationPref", conversationPrefSchema);

export default ConversationPref;

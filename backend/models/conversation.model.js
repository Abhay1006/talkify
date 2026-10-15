import mongoose from "mongoose";

// A stable, order-independent key for a pair of users, so "A and B" and
// "B and A" map to the same conversation.
export const participantsKeyFor = (a, b) => [a.toString(), b.toString()].sort().join(":");

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Backs the unique index below. Conversations created before this field
    // existed do not have it until they are next touched or the backfill in
    // scripts/backfill-participants-key.js has run.
    participantsKey: {
      type: String,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, updatedAt: -1 });
// Makes a duplicate conversation for the same pair impossible, even when two
// first messages race each other.
conversationSchema.index(
  { participantsKey: 1 },
  { unique: true, partialFilterExpression: { participantsKey: { $type: "string" } } }
);

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;

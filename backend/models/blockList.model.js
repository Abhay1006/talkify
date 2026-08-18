import mongoose from "mongoose";

const blockListSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    blockedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Makes duplicate blocks impossible even if two requests race, and gives the
// block lookup on every message send an index to use.
blockListSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true });
blockListSchema.index({ blockedUserId: 1 });

const BlockList = mongoose.model("BlockList", blockListSchema);

export default BlockList;

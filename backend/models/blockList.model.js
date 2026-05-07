import mongoose from "mongoose";

const blockListSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    blockedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

const BlockList = mongoose.model("BlockList", blockListSchema);

export default BlockList;

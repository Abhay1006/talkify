import mongoose from "mongoose";
import BlockList from "../models/blockList.model.js";
import { syncPresenceBetween } from "../socket/socket.js";
import { PUBLIC_USER_FIELDS } from "../utils/relationships.js";
import { badRequest, conflict, notFound } from "../utils/httpError.js";
import User from "../models/user.model.js";

const readTargetId = async (req) => {
  const { userId: targetId } = req.params;
  if (!mongoose.isValidObjectId(targetId)) throw badRequest("Invalid user id");
  if (req.user._id.toString() === targetId) throw badRequest("You cannot block yourself");
  if (!(await User.exists({ _id: targetId }))) throw notFound("User not found");
  return targetId;
};

// BlockList is the single source of truth for blocking. Conversations used to
// carry a duplicate status/blockedBy copy that could drift out of sync with it.
export const blockUser = async (req, res) => {
  const userId = req.user._id;
  const blockedUserId = await readTargetId(req);

  // upsert rather than check-then-insert: the compound unique index makes
  // this safe against two concurrent block requests.
  const result = await BlockList.updateOne(
    { userId, blockedUserId },
    { $setOnInsert: { userId, blockedUserId } },
    { upsert: true }
  );
  if (result.upsertedCount === 0) throw conflict("User is already blocked");

  await syncPresenceBetween(userId, blockedUserId);
  res.status(200).json({ message: "User blocked successfully" });
};

export const unblockUser = async (req, res) => {
  const userId = req.user._id;
  const blockedUserId = await readTargetId(req);

  await BlockList.deleteOne({ userId, blockedUserId });

  await syncPresenceBetween(userId, blockedUserId);
  res.status(200).json({ message: "User unblocked successfully" });
};

export const getBlockedUsers = async (req, res) => {
  const blocks = await BlockList.find({ userId: req.user._id })
    .populate("blockedUserId", PUBLIC_USER_FIELDS)
    .lean();
  res.status(200).json(blocks.map((b) => b.blockedUserId).filter(Boolean));
};

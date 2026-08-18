import mongoose from "mongoose";
import BlockList from "../models/blockList.model.js";
import User from "../models/user.model.js";

/**
 * Decides whether `senderId` is allowed to reach `receiverId` — for messages,
 * message reads, and call signaling alike.
 *
 * Blocking is checked in both directions on purpose. If A blocks B, then B must
 * not be able to message A (the obvious case) and A must not be able to message
 * B either — otherwise blocking becomes a one-way mute that still lets the
 * blocker keep contacting the person they blocked.
 *
 * Returns { ok: true, receiver } or { ok: false, status, error }.
 */
export const checkCanMessage = async (senderId, receiverId) => {
  if (!mongoose.isValidObjectId(receiverId)) {
    return { ok: false, status: 400, error: "Invalid user id" };
  }

  if (senderId.toString() === receiverId.toString()) {
    return { ok: false, status: 400, error: "You cannot message yourself" };
  }

  const receiver = await User.findById(receiverId).select("_id");
  if (!receiver) {
    return { ok: false, status: 404, error: "User not found" };
  }

  const block = await BlockList.findOne({
    $or: [
      { userId: senderId, blockedUserId: receiverId },
      { userId: receiverId, blockedUserId: senderId },
    ],
  }).select("_id");

  if (block) {
    // Deliberately vague: telling the sender "you have been blocked" hands a
    // harasser a confirmation signal. From their side it simply fails.
    return { ok: false, status: 403, error: "This conversation is unavailable" };
  }

  return { ok: true, receiver };
};

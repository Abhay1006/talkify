import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { emitToUser } from "../socket/socket.js";
import { badRequest } from "../utils/httpError.js";
import { assertCanReach, authorizeSend, findOrCreateConversation } from "../utils/relationships.js";

export const MAX_MESSAGE_LENGTH = 4000;
export const MESSAGE_PAGE_SIZE = 50;

export const sendMessage = async (req, res) => {
  const { message } = req.body ?? {};
  const { id: receiverId } = req.params;
  const senderId = req.user._id;

  if (typeof message !== "string" || !message.trim()) {
    throw badRequest("Message cannot be empty");
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw badRequest(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
  }

  // Throws for blocks, declined requests, and messages sent while a request
  // is still pending. The accept step used to exist only in the UI.
  const { openedRequest } = await authorizeSend(senderId, receiverId);

  const conversation = await findOrCreateConversation(senderId, receiverId);

  const newMessage = await Message.create({
    senderId,
    receiverId,
    body: message.trim(),
  });

  // Bumps updatedAt so the contact list stays ordered by latest activity. The
  // message itself is no longer pushed onto an ever-growing array inside the
  // conversation document — that ran toward MongoDB's 16 MB document limit.
  await Conversation.updateOne({ _id: conversation._id }, { $currentDate: { updatedAt: true } });

  emitToUser(receiverId, "newMessage", newMessage);
  // The sender's other tabs and devices need it too.
  emitToUser(senderId, "newMessage", newMessage);
  if (openedRequest) emitToUser(receiverId, "contactsUpdated");

  res.status(201).json(newMessage);
};

/**
 * Returns one page of the conversation, oldest first within the page.
 *
 *   GET /api/messages/:id              newest page
 *   GET /api/messages/:id?before=<id>  the page before that message
 *
 * Response: { messages, nextCursor } where nextCursor is null at the start of
 * the conversation.
 */
export const getMessages = async (req, res) => {
  const { id: otherId } = req.params;
  const { before } = req.query;
  const userId = req.user._id;

  await assertCanReach(userId, otherId);

  if (before !== undefined && (typeof before !== "string" || !mongoose.isValidObjectId(before))) {
    throw badRequest("Invalid cursor");
  }

  const filter = {
    $or: [
      { senderId: userId, receiverId: otherId },
      { senderId: otherId, receiverId: userId },
    ],
    ...(before && { _id: { $lt: new mongoose.Types.ObjectId(before) } }),
  };

  // Fetch one extra to learn whether an older page exists.
  const page = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(MESSAGE_PAGE_SIZE + 1);

  const hasMore = page.length > MESSAGE_PAGE_SIZE;
  const messages = page.slice(0, MESSAGE_PAGE_SIZE).reverse();

  res.status(200).json({
    messages,
    nextCursor: hasMore ? messages[0]._id : null,
  });
};

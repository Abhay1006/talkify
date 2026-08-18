import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import ChatRequest from "../models/chatRequest.model.js";
import { emitToUser } from "../socket/socket.js";
import { checkCanMessage } from "../utils/messagePermissions.js";

const MAX_MESSAGE_LENGTH = 4000;

export const sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
    }

    const permission = await checkCanMessage(senderId, receiverId);
    if (!permission.ok) {
      return res.status(permission.status).json({ error: permission.error });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });
    }

    if (conversation.status === "blocked") {
      return res.status(403).json({ error: "This conversation is unavailable" });
    }

    const existingRequest = await ChatRequest.findOne({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    });

    // A rejected request means the recipient has already declined contact, so
    // a new message must not silently reopen the thread.
    if (existingRequest?.status === "rejected") {
      return res.status(403).json({ error: "This conversation is unavailable" });
    }
    if (!existingRequest) {
      // upsert, not create: two messages sent in quick succession would
      // otherwise race and trip the unique index on { senderId, receiverId }.
      await ChatRequest.updateOne(
        { senderId, receiverId },
        { $setOnInsert: { senderId, receiverId, status: "pending" } },
        { upsert: true }
      );
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      body: message.trim(),
    });

    conversation.messages.push(newMessage._id);

    await Promise.all([conversation.save(), newMessage.save()]);

    emitToUser(receiverId, "newMessage", newMessage);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sending message", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChat } = req.params;
    const senderId = req.user._id;

    const permission = await checkCanMessage(senderId, userToChat);
    if (!permission.ok) {
      return res.status(permission.status).json({ error: permission.error });
    }

    const conversation = await Conversation.findOne({
      participants: { $all: [senderId, userToChat] },
    }).populate("messages");

    if (!conversation) {
      return res.status(200).json([]);
    }

    res.status(200).json(conversation.messages);
  } catch (error) {
    console.error("Error in getting messages", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

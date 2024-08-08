import Conversation from "../models/converstation.model.js";
import Message from "../models/message.model.js";
import { getReceiverSocketId } from "../socket/socket.js";
import { io } from "../socket/socket.js"; // Assuming io is exported from socket.js

export const sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });
    }

    // Create new message
    const newMessage = new Message({
      senderId,
      receiverId,
      message,
    });

    // Save message to conversation
    conversation.messages.push(newMessage._id);

    // Save conversation and new message
    await Promise.all([conversation.save(), newMessage.save()]);

    // Get receiver's socket ID and emit new message
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    // Respond with the newly created message
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

    // Find conversation and populate messages
    const conversation = await Conversation.findOne({
      participants: { $all: [senderId, userToChat] },
    }).populate("messages");

    // If conversation not found, return empty array
    if (!conversation) {
      return res.status(200).json([]);
    }

    // Extract messages from conversation
    const messages = conversation.messages;

    // Respond with messages
    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getting messages", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

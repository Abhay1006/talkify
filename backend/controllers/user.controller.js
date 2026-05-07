import User from "../models/user.model.js";
import ChatRequest from "../models/chatRequest.model.js";

import Conversation from "../models/conversation.model.js";

export const getAcceptedContacts = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all active conversations containing this user, sorted by updatedAt
    const conversations = await Conversation.find({
      participants: userId
    }).sort({ updatedAt: -1 }).populate('participants', '-password');

    const contacts = [];
    const seenIds = new Set();

    conversations.forEach(conv => {
      const otherUser = conv.participants.find(p => p._id.toString() !== userId.toString());
      if (otherUser && !seenIds.has(otherUser._id.toString())) {
        seenIds.add(otherUser._id.toString());
        contacts.push(otherUser);
      }
    });

    // Also include pending chat requests that don't have messages yet
    const acceptedRequests = await ChatRequest.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
      status: { $in: ['accepted', 'pending'] }
    }).populate('senderId receiverId', '-password');

    acceptedRequests.forEach(reqObj => {
      const otherUser = reqObj.senderId._id.toString() === userId.toString() ? reqObj.receiverId : reqObj.senderId;
      if (otherUser && !seenIds.has(otherUser._id.toString())) {
        seenIds.add(otherUser._id.toString());
        contacts.push(otherUser);
      }
    });

    const enrichedContacts = await Promise.all(contacts.map(async (contact) => {
      const contactObj = contact.toObject ? contact.toObject() : contact;
      const request = await ChatRequest.findOne({
        $or: [
          { senderId: userId, receiverId: contact._id },
          { senderId: contact._id, receiverId: userId }
        ]
      });
      if (request) {
        contactObj.requestStatus = request.status;
        contactObj.requestId = request._id.toString();
        contactObj.requestSenderId = request.senderId.toString();
      }
      return contactObj;
    }));

    res.status(200).json(enrichedContacts);
  } catch (error) {
    console.log("error in getAcceptedContacts", error.message);
    res.status(500).json({ error: "internal server error" });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 3) {
      return res.status(400).json({ error: "Search term must be at least 3 characters" });
    }

    const users = await User.find({
      username: { $regex: query, $options: 'i' },
      _id: { $ne: req.user._id }
    }).select('-password');

    res.status(200).json(users);
  } catch (error) {
    console.log("error in searchUsers", error.message);
    res.status(500).json({ error: "internal server error" });
  }
};

export const updateKeys = async (req, res) => {
  try {
    const { publicKey } = req.body;
    const userId = req.user._id;
    await User.findByIdAndUpdate(userId, { publicKey });
    res.status(200).json({ message: "Key updated successfully" });
  } catch (error) {
    console.log("error in updateKeys", error.message);
    res.status(500).json({ error: "internal server error" });
  }
};

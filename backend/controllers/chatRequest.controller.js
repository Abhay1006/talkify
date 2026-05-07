import ChatRequest from "../models/chatRequest.model.js";
import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";

export const sendChatRequest = async (req, res) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user._id;

    if (senderId.toString() === receiverId) {
      return res.status(400).json({ error: "Cannot send request to yourself" });
    }

    const existingRequest = await ChatRequest.findOne({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId }
      ]
    });

    if (existingRequest) {
      return res.status(400).json({ error: "Chat request already exists or you are already contacts" });
    }

    const newRequest = new ChatRequest({
      senderId,
      receiverId
    });

    await newRequest.save();
    
    // Optionally emit a socket event here
    
    res.status(201).json(newRequest);
  } catch (error) {
    console.log("Error in sendChatRequest", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPendingRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const requests = await ChatRequest.find({ receiverId: userId, status: 'pending' }).populate('senderId', '-password');
    res.status(200).json(requests);
  } catch (error) {
    console.log("Error in getPendingRequests", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const acceptChatRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const request = await ChatRequest.findById(id);

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.receiverId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    request.status = 'accepted';
    await request.save();

    let conversation = await Conversation.findOne({
      participants: { $all: [request.senderId, request.receiverId] }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [request.senderId, request.receiverId],
        status: 'active'
      });
      await conversation.save();
    } else {
      conversation.status = 'active';
      await conversation.save();
    }

    // Optionally emit a socket event here

    res.status(200).json(request);
  } catch (error) {
    console.log("Error in acceptChatRequest", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const rejectChatRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const request = await ChatRequest.findById(id);

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.receiverId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    request.status = 'rejected';
    await request.save();

    res.status(200).json(request);
  } catch (error) {
    console.log("Error in rejectChatRequest", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

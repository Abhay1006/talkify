import BlockList from "../models/blockList.model.js";
import Conversation from "../models/conversation.model.js";

export const blockUser = async (req, res) => {
  try {
    const { userId: blockedUserId } = req.params;
    const userId = req.user._id;

    const existingBlock = await BlockList.findOne({ userId, blockedUserId });
    if (existingBlock) {
      return res.status(400).json({ error: "User is already blocked" });
    }

    const block = new BlockList({ userId, blockedUserId });
    await block.save();

    const conversation = await Conversation.findOne({
      participants: { $all: [userId, blockedUserId] }
    });

    if (conversation) {
      conversation.status = 'blocked';
      conversation.blockedBy = userId;
      await conversation.save();
    }

    res.status(200).json({ message: "User blocked successfully" });
  } catch (error) {
    console.log("Error in blockUser", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { userId: blockedUserId } = req.params;
    const userId = req.user._id;

    await BlockList.findOneAndDelete({ userId, blockedUserId });

    const conversation = await Conversation.findOne({
      participants: { $all: [userId, blockedUserId] }
    });

    if (conversation && conversation.blockedBy?.toString() === userId.toString()) {
      conversation.status = 'active';
      conversation.blockedBy = null;
      await conversation.save();
    }

    res.status(200).json({ message: "User unblocked successfully" });
  } catch (error) {
    console.log("Error in unblockUser", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user._id;
    const blocks = await BlockList.find({ userId }).populate('blockedUserId', '-password');
    res.status(200).json(blocks.map(b => b.blockedUserId));
  } catch (error) {
    console.log("Error in getBlockedUsers", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

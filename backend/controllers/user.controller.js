import User from "../models/user.model.js";
import ChatRequest from "../models/chatRequest.model.js";
import BlockList from "../models/blockList.model.js";
import Conversation from "../models/conversation.model.js";

// Fields safe to expose about somebody who is not the requesting user.
const PUBLIC_USER_FIELDS = "_id fullName username profilePic bio";

export const getAcceptedContacts = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({ participants: userId })
      .sort({ updatedAt: -1 })
      .populate("participants", PUBLIC_USER_FIELDS);

    const contacts = [];
    const seenIds = new Set();

    conversations.forEach((conv) => {
      const otherUser = conv.participants.find((p) => p._id.toString() !== userId.toString());
      if (otherUser && !seenIds.has(otherUser._id.toString())) {
        seenIds.add(otherUser._id.toString());
        contacts.push(otherUser);
      }
    });

    const relatedRequests = await ChatRequest.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
      status: { $in: ["accepted", "pending"] },
    }).populate("senderId receiverId", PUBLIC_USER_FIELDS);

    relatedRequests.forEach((reqObj) => {
      const otherUser =
        reqObj.senderId._id.toString() === userId.toString() ? reqObj.receiverId : reqObj.senderId;
      if (otherUser && !seenIds.has(otherUser._id.toString())) {
        seenIds.add(otherUser._id.toString());
        contacts.push(otherUser);
      }
    });

    // Anyone involved in a block, in either direction, drops out of the list
    // entirely rather than lingering as an unusable row.
    const blocks = await BlockList.find({
      $or: [{ userId }, { blockedUserId: userId }],
    }).select("userId blockedUserId");

    const blockedIds = new Set(
      blocks.flatMap((b) => [b.userId.toString(), b.blockedUserId.toString()])
    );
    blockedIds.delete(userId.toString());

    const visibleContacts = contacts.filter((c) => !blockedIds.has(c._id.toString()));

    // Previously one findOne per contact (N+1). Fetch every relevant request in
    // a single query and join in memory.
    const contactIds = visibleContacts.map((c) => c._id);
    const allRequests = await ChatRequest.find({
      $or: [
        { senderId: userId, receiverId: { $in: contactIds } },
        { senderId: { $in: contactIds }, receiverId: userId },
      ],
    });

    const requestByContactId = new Map();
    allRequests.forEach((r) => {
      const otherId =
        r.senderId.toString() === userId.toString() ? r.receiverId.toString() : r.senderId.toString();
      requestByContactId.set(otherId, r);
    });

    const enrichedContacts = visibleContacts.map((contact) => {
      const contactObj = contact.toObject ? contact.toObject() : { ...contact };
      const request = requestByContactId.get(contact._id.toString());
      if (request) {
        contactObj.requestStatus = request.status;
        contactObj.requestId = request._id.toString();
        contactObj.requestSenderId = request.senderId.toString();
      }
      return contactObj;
    });

    res.status(200).json(enrichedContacts);
  } catch (error) {
    console.log("error in getAcceptedContacts", error.message);
    res.status(500).json({ error: "internal server error" });
  }
};

// Escapes regex metacharacters. Without this, input like "(a+)+$" reaches
// MongoDB as a live pattern and pins a database thread through catastrophic
// backtracking. See docs/V2-REDESIGN.md §3.5.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const searchUsers = async (req, res) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (query.length < 3) {
      return res.status(400).json({ error: "Search term must be at least 3 characters" });
    }
    if (query.length > 64) {
      return res.status(400).json({ error: "Search term is too long" });
    }

    const userId = req.user._id;

    const blocks = await BlockList.find({
      $or: [{ userId }, { blockedUserId: userId }],
    }).select("userId blockedUserId");

    const excludedIds = new Set(
      blocks.flatMap((b) => [b.userId.toString(), b.blockedUserId.toString()])
    );
    excludedIds.add(userId.toString());

    // Anchored so the query can use the username index instead of scanning the
    // whole collection, and projected to an explicit allowlist so search does
    // not hand out privacySettings, publicKey, lastSeen and friends.
    const users = await User.find({
      username: { $regex: `^${escapeRegex(query)}`, $options: "i" },
      _id: { $nin: [...excludedIds] },
    })
      .select(PUBLIC_USER_FIELDS)
      .limit(20);

    res.status(200).json(users);
  } catch (error) {
    console.log("error in searchUsers", error.message);
    res.status(500).json({ error: "internal server error" });
  }
};

export const updateKeys = async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (typeof publicKey !== "string" || publicKey.length > 2048) {
      return res.status(400).json({ error: "Invalid public key" });
    }
    await User.findByIdAndUpdate(req.user._id, { publicKey });
    res.status(200).json({ message: "Key updated successfully" });
  } catch (error) {
    console.log("error in updateKeys", error.message);
    res.status(500).json({ error: "internal server error" });
  }
};

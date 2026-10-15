import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import ChatRequest from "../models/chatRequest.model.js";
import { emitToUser } from "../socket/socket.js";
import { checkCanMessage } from "../utils/messagePermissions.js";
import { processImage, ImageRejectedError } from "../utils/imageProcessing.js";
import mediaStorage from "../storage/mediaStorage.js";

const MAX_MESSAGE_LENGTH = 4000;

/**
 * Finds or opens the conversation between sender and receiver, applying the
 * chat-request rules. Assumes checkCanMessage has already passed.
 *
 * Returns { ok: true, conversation } or { ok: false, status, error }.
 */
const resolveConversation = async (senderId, receiverId) => {
  let conversation = await Conversation.findOne({
    participants: { $all: [senderId, receiverId] },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [senderId, receiverId],
    });
  }

  if (conversation.status === "blocked") {
    return { ok: false, status: 403, error: "This conversation is unavailable" };
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
    return { ok: false, status: 403, error: "This conversation is unavailable" };
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

  return { ok: true, conversation };
};

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

    const resolved = await resolveConversation(senderId, receiverId);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ error: resolved.error });
    }
    const { conversation } = resolved;

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

// multipart/form-data: an `image` file field and an optional `caption`.
export const sendImageMessage = async (req, res) => {
  // Objects written to storage by this request. Removed again if the message
  // never gets saved, so failed sends don't leave orphaned files behind.
  const stored = [];

  try {
    const { id: receiverId } = req.params;
    const senderId = req.user._id;
    const caption = typeof req.body?.caption === "string" ? req.body.caption.trim() : "";

    if (!req.file) {
      return res.status(400).json({ error: "No image attached" });
    }
    if (caption.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Caption cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
    }

    // Authorize before spending CPU on decoding the image.
    const permission = await checkCanMessage(senderId, receiverId);
    if (!permission.ok) {
      return res.status(permission.status).json({ error: permission.error });
    }

    let processed;
    try {
      processed = await processImage(req.file.buffer);
    } catch (error) {
      if (error instanceof ImageRejectedError) {
        return res.status(415).json({ error: error.message });
      }
      throw error;
    }

    const resolved = await resolveConversation(senderId, receiverId);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ error: resolved.error });
    }
    const { conversation } = resolved;

    // Read access is decided from this metadata by GET /api/media/:id.
    const metadata = {
      participants: [senderId, receiverId],
      uploaderId: senderId,
      conversationId: conversation._id,
    };

    const fullId = await mediaStorage.putObject(processed.full, {
      contentType: processed.contentType,
      metadata: { ...metadata, variant: "full" },
    });
    stored.push(fullId);

    const thumbId = await mediaStorage.putObject(processed.thumb, {
      contentType: processed.contentType,
      metadata: { ...metadata, variant: "thumb" },
    });
    stored.push(thumbId);

    const newMessage = new Message({
      senderId,
      receiverId,
      body: caption || undefined,
      image: {
        fullId,
        thumbId,
        contentType: processed.contentType,
        width: processed.width,
        height: processed.height,
        animated: processed.animated,
        placeholder: processed.placeholder,
      },
    });

    await newMessage.save();
    stored.length = 0; // owned by the message from here on

    conversation.messages.push(newMessage._id);
    await conversation.save();

    emitToUser(receiverId, "newMessage", newMessage);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sending image message", error);
    await Promise.allSettled(stored.map((id) => mediaStorage.deleteObject(id)));
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

import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import ChatRequest from "../models/chatRequest.model.js";
import mongoose from "mongoose";
import { emitToUser, isUserOnline } from "../socket/socket.js";
import { checkCanMessage } from "../utils/messagePermissions.js";
import { processImage, ImageRejectedError } from "../utils/imageProcessing.js";
import mediaStorage from "../storage/mediaStorage.js";
import { sniffAudio, parseWaveform, MAX_VOICE_MS, MIN_VOICE_MS } from "../utils/audio.js";
import { fetchLinkPreview, firstUrl } from "../utils/linkPreview.js";
import { notifyUser, messagePreview } from "../utils/push.js";

const MAX_MESSAGE_LENGTH = 4000;
// Long enough to fix a typo, short enough that history stays trustworthy.
export const EDIT_WINDOW_MS = Number(process.env.MESSAGE_EDIT_WINDOW_MS) || 15 * 60 * 1000;

// Pushes a message (or an updated one) to both people's open tabs.
const broadcast = (message, event) => {
  emitToUser(message.receiverId, event, message);
  emitToUser(message.senderId, event, message);
};

// Fetches a preview card for the first link, then updates the message in
// place. Runs after the response: a slow site never delays sending.
const attachLinkPreview = async (message) => {
  const url = firstUrl(message.body);
  const current = message.linkPreview?.url;
  if (url === current) return;
  try {
    const preview = url ? await fetchLinkPreview(url) : null;
    const updated = await Message.findOneAndUpdate(
      // Only if the text hasn't been edited again meanwhile.
      { _id: message._id, body: message.body },
      preview ? { $set: { linkPreview: preview } } : { $unset: { linkPreview: 1 } },
      { new: true }
    );
    if (updated && (preview || current)) broadcast(updated, "messageUpdated");
  } catch (error) {
    console.error("Error attaching link preview", error);
  }
};

// Push notification for a recipient with no open tab. Someone with Talkify
// open already sees the message arrive.
const notifyIfOffline = (message, sender) => {
  const receiverId = message.receiverId.toString();
  if (isUserOnline(receiverId)) return;
  notifyUser(
    receiverId,
    {
      type: "message",
      title: sender.fullName,
      body: messagePreview(message),
      tag: `chat-${sender._id}`,
      url: `/?chat=${sender._id}`,
    },
    { fromUserId: sender._id }
  );
};

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

    notifyIfOffline(newMessage, req.user);
    attachLinkPreview(newMessage);
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

    notifyIfOffline(newMessage, req.user);
    if (caption) attachLinkPreview(newMessage);
  } catch (error) {
    console.error("Error in sending image message", error);
    await Promise.allSettled(stored.map((id) => mediaStorage.deleteObject(id)));
    res.status(500).json({ error: "Internal server error" });
  }
};

// multipart/form-data: an `audio` file field, `durationMs` and `waveform`.
export const sendVoiceMessage = async (req, res) => {
  let storedId = null;

  try {
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!req.file) {
      return res.status(400).json({ error: "No recording attached" });
    }
    const durationMs = Number(req.body?.durationMs);
    if (!Number.isFinite(durationMs) || durationMs < MIN_VOICE_MS || durationMs > MAX_VOICE_MS) {
      return res.status(400).json({ error: "Voice messages must be between 0.3 seconds and 5 minutes" });
    }

    const permission = await checkCanMessage(senderId, receiverId);
    if (!permission.ok) {
      return res.status(permission.status).json({ error: permission.error });
    }

    const contentType = sniffAudio(req.file.buffer);
    if (!contentType) {
      return res.status(415).json({ error: "That recording isn't a supported audio format" });
    }

    const resolved = await resolveConversation(senderId, receiverId);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ error: resolved.error });
    }
    const { conversation } = resolved;

    storedId = await mediaStorage.putObject(req.file.buffer, {
      contentType,
      metadata: {
        participants: [senderId, receiverId],
        uploaderId: senderId,
        conversationId: conversation._id,
        variant: "voice",
      },
    });

    const newMessage = new Message({
      senderId,
      receiverId,
      voice: {
        mediaId: storedId,
        contentType,
        durationMs: Math.round(durationMs),
        waveform: parseWaveform(req.body?.waveform),
      },
    });

    await newMessage.save();
    storedId = null; // owned by the message from here on

    conversation.messages.push(newMessage._id);
    await conversation.save();

    emitToUser(receiverId, "newMessage", newMessage);
    res.status(201).json(newMessage);

    notifyIfOffline(newMessage, req.user);
  } catch (error) {
    console.error("Error in sending voice message", error);
    if (storedId) await mediaStorage.deleteObject(storedId).catch(() => {});
    res.status(500).json({ error: "Internal server error" });
  }
};

// Edit the text of your own message, within EDIT_WINDOW_MS of sending it.
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { message: text } = req.body ?? {};

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
    }

    const message = await Message.findById(messageId);
    // Someone else's message is "not found", not "forbidden": no probing.
    if (!message || message.senderId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (message.call || message.voice) {
      return res.status(400).json({ error: "This message can't be edited" });
    }
    if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
      return res.status(403).json({ error: "Messages can only be edited for 15 minutes after sending" });
    }

    const permission = await checkCanMessage(req.user._id, message.receiverId);
    if (!permission.ok) {
      return res.status(permission.status).json({ error: permission.error });
    }

    const body = text.trim();
    if (body === message.body) return res.status(200).json(message);

    message.body = body;
    message.editedAt = new Date();
    await message.save();

    broadcast(message, "messageUpdated");
    res.status(200).json(message);

    attachLinkPreview(message);
  } catch (error) {
    console.error("Error in editing message", error);
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

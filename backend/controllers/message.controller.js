import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { emitToUser, isUserOnline } from "../socket/socket.js";
import { HttpError, badRequest, forbidden, notFound } from "../utils/httpError.js";
import { assertCanReach, authorizeSend, findOrCreateConversation } from "../utils/relationships.js";
import { processImage, ImageRejectedError } from "../utils/imageProcessing.js";
import mediaStorage from "../storage/mediaStorage.js";
import { sniffAudio, parseWaveform, MAX_VOICE_MS, MIN_VOICE_MS } from "../utils/audio.js";
import { fetchLinkPreview, firstUrl } from "../utils/linkPreview.js";
import { notifyUser, messagePreview } from "../utils/push.js";

export const MAX_MESSAGE_LENGTH = 4000;
export const MESSAGE_PAGE_SIZE = 50;
// Long enough to fix a typo, short enough that history stays trustworthy.
export const EDIT_WINDOW_MS = Number(process.env.MESSAGE_EDIT_WINDOW_MS) || 15 * 60 * 1000;

// Pushes a message (new or updated) to both people's open tabs. The sender's
// other tabs and devices need it too.
const broadcast = (message, event) => {
  emitToUser(message.receiverId, event, message);
  emitToUser(message.senderId, event, message);
};

// Bumps updatedAt so the contact list stays ordered by latest activity. The
// message itself is no longer pushed onto an ever-growing array inside the
// conversation document — that ran toward MongoDB's 16 MB document limit.
const touchConversation = (conversation) =>
  Conversation.updateOne({ _id: conversation._id }, { $currentDate: { updatedAt: true } });

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

// Everything after a message has been authorised and built: save it, keep the
// contact list ordered, deliver it, and start the follow-ups.
const deliver = async (message, { req, res, conversation, openedRequest }) => {
  // Media messages are saved by their handler first, so their files can be
  // cleaned up if the save fails.
  if (message.isNew) await message.save();
  await touchConversation(conversation);

  broadcast(message, "newMessage");
  if (openedRequest) emitToUser(message.receiverId, "contactsUpdated");

  res.status(201).json(message);

  notifyIfOffline(message, req.user);
  if (message.body) attachLinkPreview(message);
};

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

  const newMessage = new Message({ senderId, receiverId, body: message.trim() });
  await deliver(newMessage, { req, res, conversation, openedRequest });
};

// multipart/form-data: an `image` file field and an optional `caption`.
export const sendImageMessage = async (req, res) => {
  const { id: receiverId } = req.params;
  const senderId = req.user._id;
  const caption = typeof req.body?.caption === "string" ? req.body.caption.trim() : "";

  if (!req.file) throw badRequest("No image attached");
  if (caption.length > MAX_MESSAGE_LENGTH) {
    throw badRequest(`Caption cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
  }

  // Cheap checks first (no side effects), so blocked senders don't cost a
  // decode; the chat-request rules run after the image is known to be good.
  await assertCanReach(senderId, receiverId);

  let processed;
  try {
    processed = await processImage(req.file.buffer);
  } catch (error) {
    if (error instanceof ImageRejectedError) throw new HttpError(415, error.message);
    throw error;
  }

  const { openedRequest } = await authorizeSend(senderId, receiverId);
  const conversation = await findOrCreateConversation(senderId, receiverId);

  // Read access is decided from this metadata by GET /api/media/:id.
  const metadata = {
    participants: [senderId, receiverId],
    uploaderId: senderId,
    conversationId: conversation._id,
  };

  // Objects written by this request, removed again if the message never gets
  // saved, so failed sends don't leave orphaned files behind.
  const stored = [];
  try {
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

    await deliver(newMessage, { req, res, conversation, openedRequest });
  } finally {
    await Promise.allSettled(stored.map((id) => mediaStorage.deleteObject(id)));
  }
};

// multipart/form-data: an `audio` file field, `durationMs` and `waveform`.
export const sendVoiceMessage = async (req, res) => {
  const { id: receiverId } = req.params;
  const senderId = req.user._id;

  if (!req.file) throw badRequest("No recording attached");
  const durationMs = Number(req.body?.durationMs);
  if (!Number.isFinite(durationMs) || durationMs < MIN_VOICE_MS || durationMs > MAX_VOICE_MS) {
    throw badRequest("Voice messages must be between 0.3 seconds and 5 minutes");
  }

  await assertCanReach(senderId, receiverId);

  const contentType = sniffAudio(req.file.buffer);
  if (!contentType) throw new HttpError(415, "That recording isn't a supported audio format");

  const { openedRequest } = await authorizeSend(senderId, receiverId);
  const conversation = await findOrCreateConversation(senderId, receiverId);

  let storedId = await mediaStorage.putObject(req.file.buffer, {
    contentType,
    metadata: {
      participants: [senderId, receiverId],
      uploaderId: senderId,
      conversationId: conversation._id,
      variant: "voice",
    },
  });
  try {
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

    await deliver(newMessage, { req, res, conversation, openedRequest });
  } finally {
    if (storedId) await mediaStorage.deleteObject(storedId).catch(() => {});
  }
};

// Edit the text of your own message, within EDIT_WINDOW_MS of sending it.
export const editMessage = async (req, res) => {
  const { messageId } = req.params;
  const { message: text } = req.body ?? {};

  if (!mongoose.isValidObjectId(messageId)) throw notFound("Message not found");
  if (typeof text !== "string" || !text.trim()) throw badRequest("Message cannot be empty");
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw badRequest(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
  }

  const message = await Message.findById(messageId);
  // Someone else's message is "not found", not "forbidden": no probing.
  if (!message || message.senderId.toString() !== req.user._id.toString()) {
    throw notFound("Message not found");
  }
  if (message.call || message.voice) throw badRequest("This message can't be edited");
  if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
    throw forbidden("Messages can only be edited for 15 minutes after sending");
  }

  await assertCanReach(req.user._id, message.receiverId);

  const body = text.trim();
  if (body === message.body) return res.status(200).json(message);

  message.body = body;
  message.editedAt = new Date();
  await message.save();

  broadcast(message, "messageUpdated");
  res.status(200).json(message);

  attachLinkPreview(message);
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

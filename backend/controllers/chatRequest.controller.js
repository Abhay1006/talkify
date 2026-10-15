import mongoose from "mongoose";
import ChatRequest from "../models/chatRequest.model.js";
import { emitToUser, syncPresenceBetween } from "../socket/socket.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/httpError.js";
import {
  PUBLIC_USER_FIELDS,
  assertCanReach,
  findOrCreateConversation,
  findRequestBetween,
  getBlockedIds,
} from "../utils/relationships.js";

export const sendChatRequest = async (req, res) => {
  const { receiverId } = req.body ?? {};
  const senderId = req.user._id;

  if (typeof receiverId !== "string") throw badRequest("Invalid user id");
  await assertCanReach(senderId, receiverId);

  const existingRequest = await findRequestBetween(senderId, receiverId);
  if (existingRequest) {
    throw conflict("Chat request already exists or you are already contacts");
  }

  let newRequest;
  try {
    newRequest = await ChatRequest.create({ senderId, receiverId });
  } catch (error) {
    if (error.code === 11000) throw conflict("Chat request already exists");
    throw error;
  }

  emitToUser(receiverId, "contactsUpdated");
  res.status(201).json(newRequest);
};

export const getPendingRequests = async (req, res) => {
  const userId = req.user._id;
  const [requests, blockedIds] = await Promise.all([
    ChatRequest.find({ receiverId: userId, status: "pending" })
      .populate("senderId", PUBLIC_USER_FIELDS)
      .lean(),
    getBlockedIds(userId),
  ]);

  res.status(200).json(requests.filter((r) => r.senderId && !blockedIds.has(r.senderId._id.toString())));
};

// Loads a request the current user received and that is still awaiting an
// answer. Accepting or declining twice, or flipping a decline into an accept,
// is not allowed.
const loadPendingRequestFor = async (req) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid request id");

  const request = await ChatRequest.findById(id);
  if (!request) throw notFound("Request not found");
  if (request.receiverId.toString() !== req.user._id.toString()) throw forbidden("Unauthorized");
  if (request.status !== "pending") throw conflict(`This request was already ${request.status}`);

  return request;
};

export const acceptChatRequest = async (req, res) => {
  const request = await loadPendingRequestFor(req);
  await assertCanReach(request.receiverId, request.senderId);

  request.status = "accepted";
  await request.save();
  await findOrCreateConversation(request.senderId, request.receiverId);

  // Without this the sender sat on "Waiting for them to accept" until they
  // happened to reload.
  emitToUser(request.senderId, "contactsUpdated");
  await syncPresenceBetween(request.senderId, request.receiverId);

  res.status(200).json(request);
};

export const rejectChatRequest = async (req, res) => {
  const request = await loadPendingRequestFor(req);

  request.status = "rejected";
  await request.save();

  // The sender is deliberately not notified; a decline looks the same to them
  // as a request that is still pending.
  res.status(200).json(request);
};

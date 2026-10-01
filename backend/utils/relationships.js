import mongoose from "mongoose";
import BlockList from "../models/blockList.model.js";
import ChatRequest from "../models/chatRequest.model.js";
import Conversation, { participantsKeyFor } from "../models/conversation.model.js";
import User from "../models/user.model.js";
import { HttpError, badRequest, forbidden, notFound } from "./httpError.js";

// Fields safe to expose about somebody who is not the requesting user.
export const PUBLIC_USER_FIELDS = "_id fullName username profilePic";

// Deliberately vague: telling someone "you have been blocked" or "they
// declined" hands a harasser a confirmation signal. From their side it simply
// fails.
const UNAVAILABLE = "This conversation is unavailable";

const idOf = (value) => value.toString();

/** Ids of everyone involved in a block with `userId`, in either direction. */
export const getBlockedIds = async (userId) => {
  const blocks = await BlockList.find({
    $or: [{ userId }, { blockedUserId: userId }],
  })
    .select("userId blockedUserId")
    .lean();

  const ids = new Set(blocks.flatMap((b) => [idOf(b.userId), idOf(b.blockedUserId)]));
  ids.delete(idOf(userId));
  return ids;
};

export const isBlockedBetween = async (a, b) =>
  Boolean(
    await BlockList.exists({
      $or: [
        { userId: a, blockedUserId: b },
        { userId: b, blockedUserId: a },
      ],
    })
  );

export const findRequestBetween = (a, b) =>
  ChatRequest.findOne({
    $or: [
      { senderId: a, receiverId: b },
      { senderId: b, receiverId: a },
    ],
  });

/**
 * Everyone `userId` has a relationship with, most recently active first.
 *
 * Returns [{ otherId, request, hasConversation }] for every person who is
 * neither blocked (either direction) nor someone whose request `userId`
 * declined.
 */
const getRelationships = async (userId) => {
  const [conversations, requests, blockedIds] = await Promise.all([
    Conversation.find({ participants: userId }).sort({ updatedAt: -1 }).select("participants").lean(),
    ChatRequest.find({ $or: [{ senderId: userId }, { receiverId: userId }] }).lean(),
    getBlockedIds(userId),
  ]);

  const byOtherId = new Map();
  const touch = (otherId) => {
    if (!byOtherId.has(otherId)) byOtherId.set(otherId, { otherId, request: null, hasConversation: false });
    return byOtherId.get(otherId);
  };

  for (const conv of conversations) {
    const other = conv.participants.find((p) => idOf(p) !== idOf(userId));
    if (other) touch(idOf(other)).hasConversation = true;
  }
  for (const request of requests) {
    const otherId =
      idOf(request.senderId) === idOf(userId) ? idOf(request.receiverId) : idOf(request.senderId);
    touch(otherId).request = request;
  }

  // Whoever declined a request no longer sees that person. The sender keeps
  // seeing it as pending (see requestFields), so a decline is not announced.
  const declinedByMe = (rel) =>
    rel.request?.status === "rejected" && idOf(rel.request.receiverId) === idOf(userId);

  return [...byOtherId.values()].filter((rel) => !blockedIds.has(rel.otherId) && !declinedByMe(rel));
};

// Conversations created before chat requests existed have no request at all.
// Those people were already talking, so they count as accepted contacts.
const isAcceptedRelationship = (rel) =>
  rel.request ? rel.request.status === "accepted" : rel.hasConversation;

/** Ids of the people allowed to see `userId`'s online status. */
export const getPresenceContactIds = async (userId) =>
  (await getRelationships(userId)).filter(isAcceptedRelationship).map((rel) => rel.otherId);

// The sender of a declined request is shown it as still pending, for the same
// reason blocks are not announced.
const requestFields = (request, viewerId) => {
  if (!request) return {};
  const declinedOnViewer = request.status === "rejected" && idOf(request.senderId) === idOf(viewerId);
  return {
    requestStatus: declinedOnViewer ? "pending" : request.status,
    requestId: idOf(request._id),
    requestSenderId: idOf(request.senderId),
  };
};

/** The sidebar contact list: profiles plus the state of the chat request. */
export const getContactsFor = async (userId) => {
  const relationships = await getRelationships(userId);
  const users = await User.find({ _id: { $in: relationships.map((r) => r.otherId) } })
    .select(PUBLIC_USER_FIELDS)
    .lean();

  const userById = new Map(users.map((u) => [idOf(u._id), u]));
  return relationships
    .filter((rel) => userById.has(rel.otherId))
    .map((rel) => ({ ...userById.get(rel.otherId), ...requestFields(rel.request, userId) }));
};

/** Adds request state to arbitrary user profiles (used by search). */
export const withRequestState = async (userId, users) => {
  const ids = users.map((u) => u._id);
  const requests = await ChatRequest.find({
    $or: [
      { senderId: userId, receiverId: { $in: ids } },
      { senderId: { $in: ids }, receiverId: userId },
    ],
  }).lean();

  const requestByOtherId = new Map(
    requests.map((r) => [idOf(r.senderId) === idOf(userId) ? idOf(r.receiverId) : idOf(r.senderId), r])
  );
  return users.map((u) => ({ ...u, ...requestFields(requestByOtherId.get(idOf(u._id)), userId) }));
};

/**
 * Throws unless `userId` may see or contact `otherId` at all: a valid,
 * existing, different user with no block between them in either direction.
 *
 * Blocking is checked in both directions on purpose. If A blocks B, then B must
 * not be able to message A (the obvious case) and A must not be able to message
 * B either — otherwise blocking becomes a one-way mute that still lets the
 * blocker keep contacting the person they blocked.
 */
export const assertCanReach = async (userId, otherId) => {
  if (!mongoose.isValidObjectId(otherId)) throw badRequest("Invalid user id");
  if (idOf(userId) === idOf(otherId)) throw badRequest("You cannot message yourself");

  const exists = await User.exists({ _id: otherId });
  if (!exists) throw notFound("User not found");

  if (await isBlockedBetween(userId, otherId)) throw forbidden(UNAVAILABLE);
};

/** Returns the conversation for a pair, creating it if needed. Race-safe. */
export const findOrCreateConversation = async (a, b) => {
  const participantsKey = participantsKeyFor(a, b);

  // Conversations created before participantsKey existed are found by
  // membership and get the key added on the way through.
  const legacy = await Conversation.findOne({
    participants: { $all: [a, b] },
    participantsKey: { $exists: false },
  });
  if (legacy) {
    try {
      legacy.participantsKey = participantsKey;
      await legacy.save();
      return legacy;
    } catch (error) {
      if (error.code !== 11000) throw error;
      // A keyed conversation for this pair already exists; use that one.
    }
  }

  return Conversation.findOneAndUpdate(
    { participantsKey },
    { $setOnInsert: { participantsKey, participants: [a, b] } },
    { upsert: true, new: true }
  );
};

/**
 * Decides whether `senderId` may send a message to `receiverId` right now, and
 * records the opening chat request when this is first contact.
 *
 * - No relationship yet: the message goes through and opens a pending request.
 * - Pending: nobody may send more until the receiver accepts. The sender has
 *   had their one opening message; the receiver must accept before replying.
 * - Declined: unavailable (and indistinguishable from pending for the sender).
 * - Accepted: allowed.
 *
 * Returns { openedRequest } so the caller can notify the receiver.
 */
export const authorizeSend = async (senderId, receiverId) => {
  await assertCanReach(senderId, receiverId);

  let request = await findRequestBetween(senderId, receiverId);

  if (!request) {
    const legacyConversation = await Conversation.exists({ participants: { $all: [senderId, receiverId] } });
    const status = legacyConversation ? "accepted" : "pending";
    // upsert, not create: two messages sent in quick succession would
    // otherwise race and trip the unique index on { senderId, receiverId }.
    const result = await ChatRequest.updateOne(
      { senderId, receiverId },
      { $setOnInsert: { senderId, receiverId, status } },
      { upsert: true }
    );
    if (result.upsertedCount > 0) return { openedRequest: status === "pending" };

    // A concurrent request won the race. Judge this message against it, so
    // two simultaneous "first" messages cannot both get through.
    request = await findRequestBetween(senderId, receiverId);
  }

  if (request.status === "accepted") return { openedRequest: false };

  const isRequestSender = idOf(request.senderId) === idOf(senderId);
  // A declined sender gets the same answer as a pending one.
  if (isRequestSender) throw new HttpError(403, "Your message request hasn't been accepted yet");
  if (request.status === "rejected") throw forbidden(UNAVAILABLE);
  throw new HttpError(403, "Accept the message request to reply");
};

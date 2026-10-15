import mongoose from "mongoose";
import User, { USERNAME_COLLATION } from "../models/user.model.js";
import ConversationPref from "../models/conversationPref.model.js";
import mediaStorage from "../storage/mediaStorage.js";
import { processAvatar, ImageRejectedError } from "../utils/imageProcessing.js";
import { HttpError, badRequest } from "../utils/httpError.js";
import { toSelf } from "./auth.controller.js";
import {
  PUBLIC_USER_FIELDS,
  getBlockedIds,
  getContactsFor,
  withRequestState,
} from "../utils/relationships.js";

export const SEARCH_MIN_LENGTH = 3;
export const SEARCH_MAX_LENGTH = 64;
const SEARCH_RESULT_LIMIT = 20;

// The sidebar list, with this user's own pin / mute / archive flags.
export const getContacts = async (req, res) => {
  const contacts = await getContactsFor(req.user._id);
  const prefs = await ConversationPref.find({
    userId: req.user._id,
    partnerId: { $in: contacts.map((c) => c._id) },
  }).lean();
  const prefsById = new Map(prefs.map((p) => [p.partnerId.toString(), p]));

  res.status(200).json(
    contacts.map((contact) => {
      const pref = prefsById.get(contact._id.toString());
      return { ...contact, pinned: !!pref?.pinned, muted: !!pref?.muted, archived: !!pref?.archived };
    })
  );
};

export const searchUsers = async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (query.length < SEARCH_MIN_LENGTH) {
    throw badRequest(`Search term must be at least ${SEARCH_MIN_LENGTH} characters`);
  }
  if (query.length > SEARCH_MAX_LENGTH) {
    throw badRequest("Search term is too long");
  }

  const userId = req.user._id;
  const excludedIds = await getBlockedIds(userId);
  excludedIds.add(userId.toString());

  // A case-insensitive prefix match written as a range under a case-insensitive
  // collation, so it can walk the username_ci index. The previous /^q/i regex
  // could not use index bounds and scanned every key. In ICU collation U+FFFF
  // sorts after every real character, which closes the prefix range.
  const users = await User.find({
    username: { $gte: query, $lt: `${query}￿` },
    _id: { $nin: [...excludedIds] },
  })
    .collation(USERNAME_COLLATION)
    .sort({ username: 1 })
    .select(PUBLIC_USER_FIELDS)
    .limit(SEARCH_RESULT_LIMIT)
    .lean();

  res.status(200).json(await withRequestState(userId, users));
};

const MAX_NAME_LENGTH = 50;
const MAX_BIO_LENGTH = 160;

export const updateMe = async (req, res) => {
  const { fullName, bio } = req.body ?? {};
  const update = {};

  if (fullName !== undefined) {
    if (typeof fullName !== "string" || !fullName.trim()) throw badRequest("Name can't be empty");
    if (fullName.trim().length > MAX_NAME_LENGTH) {
      throw badRequest(`Name can be at most ${MAX_NAME_LENGTH} characters`);
    }
    update.fullName = fullName.trim();
  }
  if (bio !== undefined) {
    if (typeof bio !== "string" || bio.length > MAX_BIO_LENGTH) {
      throw badRequest(`Bio can be at most ${MAX_BIO_LENGTH} characters`);
    }
    update.bio = bio.trim();
  }

  const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
  res.status(200).json(toSelf(user));
};

const ownedAvatarId = (user) => {
  const match = /^\/api\/media\/([a-f0-9]{24})$/.exec(user.profilePic ?? "");
  return match ? match[1] : null;
};

// multipart/form-data with an `image` field.
export const updateAvatar = async (req, res) => {
  if (!req.file) throw badRequest("No image attached");

  let avatar;
  try {
    avatar = await processAvatar(req.file.buffer);
  } catch (error) {
    if (error instanceof ImageRejectedError) throw new HttpError(415, error.message);
    throw error;
  }

  // Public: profile pictures are shown to anyone who can see the name.
  let storedId = await mediaStorage.putObject(avatar, {
    contentType: "image/webp",
    metadata: { public: true, kind: "avatar", ownerId: req.user._id },
  });

  try {
    const previousId = ownedAvatarId(req.user);
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePic: `/api/media/${storedId}` },
      { new: true }
    );
    storedId = null;

    if (previousId) {
      // Only delete what was really this user's avatar.
      const previous = await mediaStorage.getObject(previousId);
      if (
        previous?.metadata.kind === "avatar" &&
        String(previous.metadata.ownerId) === req.user._id.toString()
      ) {
        await mediaStorage.deleteObject(previousId).catch(() => {});
      }
    }

    res.status(200).json(toSelf(user));
  } finally {
    if (storedId) await mediaStorage.deleteObject(storedId).catch(() => {});
  }
};

// Pin / mute / archive a chat. Only the flags present are changed.
export const updateConversationPrefs = async (req, res) => {
  const { partnerId } = req.params;
  if (!mongoose.isValidObjectId(partnerId) || partnerId === req.user._id.toString()) {
    throw badRequest("Invalid user id");
  }

  const update = {};
  for (const key of ["pinned", "muted", "archived"]) {
    if (req.body?.[key] !== undefined) {
      if (typeof req.body[key] !== "boolean") throw badRequest(`${key} must be true or false`);
      update[key] = req.body[key];
    }
  }
  if (!Object.keys(update).length) throw badRequest("Nothing to update");

  const pref = await ConversationPref.findOneAndUpdate(
    { userId: req.user._id, partnerId },
    { $set: update, $setOnInsert: { userId: req.user._id, partnerId } },
    { upsert: true, new: true }
  );
  res.status(200).json({ partnerId, pinned: pref.pinned, muted: pref.muted, archived: pref.archived });
};

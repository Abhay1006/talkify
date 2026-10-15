import User, { USERNAME_COLLATION } from "../models/user.model.js";
import { badRequest } from "../utils/httpError.js";
import {
  PUBLIC_USER_FIELDS,
  getBlockedIds,
  getContactsFor,
  withRequestState,
} from "../utils/relationships.js";

export const SEARCH_MIN_LENGTH = 3;
export const SEARCH_MAX_LENGTH = 64;
const SEARCH_RESULT_LIMIT = 20;

export const getContacts = async (req, res) => {
  res.status(200).json(await getContactsFor(req.user._id));
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

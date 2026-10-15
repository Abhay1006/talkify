import User from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { unauthorized } from "../utils/httpError.js";
import { SESSION_COOKIE, decodeSessionToken } from "../utils/session.js";

const protectRoute = asyncHandler(async (req, res, next) => {
  const decoded = decodeSessionToken(req.cookies[SESSION_COOKIE]);
  if (!decoded) throw unauthorized("Your session has expired. Please log in again.");

  const user = await User.findById(decoded.userId).select("_id fullName username profilePic bio");
  // 401, not 404: the client treats 401 as "log out", which is the right
  // outcome for a token whose account no longer exists.
  if (!user) throw unauthorized("Your session has expired. Please log in again.");

  req.user = user;
  req.sessionToken = req.cookies[SESSION_COOKIE];
  next();
});

export default protectRoute;

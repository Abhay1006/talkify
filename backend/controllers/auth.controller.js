import bcrypt from "bcryptjs";
import User, { USERNAME_COLLATION } from "../models/user.model.js";
import { disconnectSession } from "../socket/socket.js";
import { defaultAvatarUrl } from "../utils/avatar.js";
import { badRequest, conflict } from "../utils/httpError.js";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  decodeSessionToken,
  setSessionCookie,
} from "../utils/session.js";

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/;
export const PASSWORD_MIN_LENGTH = 6;
// bcrypt ignores everything past 72 bytes, so a longer limit would accept
// characters that silently play no part in the hash.
export const PASSWORD_MAX_LENGTH = 72;
const FULL_NAME_MAX_LENGTH = 50;
const GENDERS = ["male", "female"];

const toSelf = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  username: user.username,
  profilePic: user.profilePic,
});

// Every credential field must be a plain string. Without this check a body
// such as { "username": { "$ne": null } } reaches MongoDB as a query operator.
const isString = (value) => typeof value === "string";

export const loginUser = async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!isString(username) || !isString(password) || !username.trim() || !password) {
    throw badRequest("Username and password are required");
  }

  const user = await User.findOne({ username: username.trim() }).collation(USERNAME_COLLATION);
  // Always run bcrypt, even for an unknown username, so response timing does
  // not reveal which usernames exist.
  const isPasswordCorrect = await bcrypt.compare(password, user?.password ?? "");

  if (!user || !isPasswordCorrect) {
    throw badRequest("Invalid username or password");
  }

  setSessionCookie(req, res, user._id);
  res.status(200).json(toSelf(user));
};

export const logoutUser = async (req, res) => {
  const token = req.cookies[SESSION_COOKIE];
  const decoded = decodeSessionToken(token);
  if (decoded) disconnectSession(decoded.userId, token);

  clearSessionCookie(req, res);
  res.status(200).json({ message: "Logged out successfully" });
};

export const getMe = async (req, res) => {
  res.status(200).json(toSelf(req.user));
};

export const signupUser = async (req, res) => {
  const { fullName, username, password, confirmPassword, gender } = req.body ?? {};

  if (![fullName, username, password, confirmPassword, gender].every(isString)) {
    throw badRequest("All fields are required");
  }

  const cleanFullName = fullName.trim();
  const cleanUsername = username.trim().toLowerCase();

  if (!cleanFullName || !cleanUsername || !password || !confirmPassword || !gender) {
    throw badRequest("All fields are required");
  }
  if (cleanFullName.length > FULL_NAME_MAX_LENGTH) {
    throw badRequest(`Full name cannot exceed ${FULL_NAME_MAX_LENGTH} characters`);
  }
  if (!USERNAME_PATTERN.test(cleanUsername)) {
    throw badRequest("Username must be 3-20 characters: letters, numbers, dots and underscores");
  }
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw badRequest(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`);
  }
  if (password !== confirmPassword) {
    throw badRequest("Passwords don't match");
  }
  if (!GENDERS.includes(gender)) {
    throw badRequest("Please select a gender");
  }

  const existing = await User.exists({ username: cleanUsername }).collation(USERNAME_COLLATION);
  if (existing) throw conflict("Username already exists");

  const hashedPassword = await bcrypt.hash(password, 10);

  let newUser;
  try {
    newUser = await User.create({
      fullName: cleanFullName,
      username: cleanUsername,
      password: hashedPassword,
      gender,
      profilePic: defaultAvatarUrl(cleanUsername, gender),
    });
  } catch (error) {
    // Two signups for the same name raced past the check above.
    if (error.code === 11000) throw conflict("Username already exists");
    throw error;
  }

  // Only after the user is saved: setting it first handed out a session for an
  // account that might never have been created.
  setSessionCookie(req, res, newUser._id);
  res.status(201).json(toSelf(newUser));
};

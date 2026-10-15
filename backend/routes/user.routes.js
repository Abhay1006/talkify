import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import { searchLimiter, uploadLimiter } from "../middleware/rateLimit.js";
import { uploadImage } from "../middleware/upload.js";
import {
  getContacts,
  searchUsers,
  updateMe,
  updateAvatar,
  updateConversationPrefs,
} from "../controllers/user.controller.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.use(protectRoute);

router.get("/", asyncHandler(getContacts));
router.get("/search", searchLimiter, asyncHandler(searchUsers));
// The current profile is GET /api/auth/me.
router.put("/me", asyncHandler(updateMe));
router.post("/me/avatar", uploadLimiter, uploadImage, asyncHandler(updateAvatar));
router.put("/prefs/:partnerId", asyncHandler(updateConversationPrefs));

export default router;

import express from "express";
import {
  editMessage,
  getMessages,
  sendImageMessage,
  sendMessage,
  sendVoiceMessage,
} from "../controllers/message.controller.js";
import protectRoute from "../middleware/protectRoute.js";
import { messageLimiter, uploadLimiter } from "../middleware/rateLimit.js";
import { uploadImage, uploadAudio } from "../middleware/upload.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.use(protectRoute);

router.get("/:id", asyncHandler(getMessages));
router.post("/send/:id", messageLimiter, asyncHandler(sendMessage));
// Limiters run before multer so a rejected request is never buffered.
router.post("/send/:id/image", messageLimiter, uploadLimiter, uploadImage, asyncHandler(sendImageMessage));
router.post("/send/:id/voice", messageLimiter, uploadLimiter, uploadAudio, asyncHandler(sendVoiceMessage));
router.patch("/:messageId", messageLimiter, asyncHandler(editMessage));

export default router;

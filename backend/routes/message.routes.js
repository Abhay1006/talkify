import e from "express";
import { editMessage, getMessages, sendImageMessage, sendMessage, sendVoiceMessage } from "../controllers/message.controller.js";
import protectRoute from "../middleware/protectRoute.js";
import { messageLimiter, uploadLimiter } from "../middleware/rateLimit.js";
import { uploadImage, uploadAudio } from "../middleware/upload.js";

const router = e.Router();

router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, messageLimiter, sendMessage);
// Limiters run before multer so a rejected request is never buffered.
router.post("/send/:id/image", protectRoute, messageLimiter, uploadLimiter, uploadImage, sendImageMessage);
router.post("/send/:id/voice", protectRoute, messageLimiter, uploadLimiter, uploadAudio, sendVoiceMessage);
router.patch("/:messageId", protectRoute, messageLimiter, editMessage);

export default router;

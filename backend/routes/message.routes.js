import e from "express";
import { getMessages, sendImageMessage, sendMessage } from "../controllers/message.controller.js";
import protectRoute from "../middleware/protectRoute.js";
import { messageLimiter, uploadLimiter } from "../middleware/rateLimit.js";
import uploadImage from "../middleware/uploadImage.js";

const router = e.Router();

router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, messageLimiter, sendMessage);
// Limiters run before multer so a rejected request is never buffered.
router.post("/send/:id/image", protectRoute, messageLimiter, uploadLimiter, uploadImage, sendImageMessage);

export default router;

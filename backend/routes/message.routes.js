import e from "express";
import { getMessages, sendMessage } from "../controllers/message.controller.js";
import protectRoute from "../middleware/protectRoute.js";
import { messageLimiter } from "../middleware/rateLimit.js";

const router = e.Router();

router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, messageLimiter, sendMessage);

export default router;

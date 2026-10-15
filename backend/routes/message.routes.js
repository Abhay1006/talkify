import express from "express";
import { getMessages, sendMessage } from "../controllers/message.controller.js";
import protectRoute from "../middleware/protectRoute.js";
import { messageLimiter } from "../middleware/rateLimit.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.use(protectRoute);

router.get("/:id", asyncHandler(getMessages));
router.post("/send/:id", messageLimiter, asyncHandler(sendMessage));

export default router;

import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import { acceptChatRequest, getPendingRequests, rejectChatRequest, sendChatRequest } from "../controllers/chatRequest.controller.js";

const router = express.Router();

router.post("/send", protectRoute, sendChatRequest);
router.get("/pending", protectRoute, getPendingRequests);
router.put("/:id/accept", protectRoute, acceptChatRequest);
router.put("/:id/reject", protectRoute, rejectChatRequest);

export default router;

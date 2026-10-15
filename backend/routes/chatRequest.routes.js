import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import {
  acceptChatRequest,
  getPendingRequests,
  rejectChatRequest,
  sendChatRequest,
} from "../controllers/chatRequest.controller.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.use(protectRoute);

router.post("/send", asyncHandler(sendChatRequest));
router.get("/pending", asyncHandler(getPendingRequests));
router.put("/:id/accept", asyncHandler(acceptChatRequest));
router.put("/:id/reject", asyncHandler(rejectChatRequest));

export default router;

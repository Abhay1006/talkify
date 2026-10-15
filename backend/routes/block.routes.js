import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import { blockUser, getBlockedUsers, unblockUser } from "../controllers/block.controller.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.use(protectRoute);

// Registered before /:userId so "list" is never mistaken for a user id.
router.get("/list", asyncHandler(getBlockedUsers));
router.post("/:userId", asyncHandler(blockUser));
router.delete("/:userId", asyncHandler(unblockUser));

export default router;

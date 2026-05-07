import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import { blockUser, getBlockedUsers, unblockUser } from "../controllers/block.controller.js";

const router = express.Router();

router.post("/:userId", protectRoute, blockUser);
router.delete("/:userId", protectRoute, unblockUser);
router.get("/list", protectRoute, getBlockedUsers);

export default router;

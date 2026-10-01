import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import { searchLimiter } from "../middleware/rateLimit.js";
import { getContacts, searchUsers } from "../controllers/user.controller.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.use(protectRoute);

router.get("/", asyncHandler(getContacts));
router.get("/search", searchLimiter, asyncHandler(searchUsers));

export default router;

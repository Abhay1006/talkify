import express from "express";
import { getMe, loginUser, logoutUser, signupUser } from "../controllers/auth.controller.js";
import protectRoute from "../middleware/protectRoute.js";
import { authLimiter } from "../middleware/rateLimit.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.post("/login", authLimiter, asyncHandler(loginUser));
router.post("/signup", authLimiter, asyncHandler(signupUser));
router.post("/logout", asyncHandler(logoutUser));
router.get("/me", protectRoute, asyncHandler(getMe));

export default router;

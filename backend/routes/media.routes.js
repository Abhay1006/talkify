import express from "express";
import { getMedia } from "../controllers/media.controller.js";
import protectRoute from "../middleware/protectRoute.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.get("/:id", protectRoute, asyncHandler(getMedia));

export default router;

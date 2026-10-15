import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import { getPushConfig, subscribe, unsubscribe } from "../controllers/push.controller.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.use(protectRoute);

router.get("/config", getPushConfig);
router.post("/subscribe", asyncHandler(subscribe));
router.post("/unsubscribe", asyncHandler(unsubscribe));

export default router;

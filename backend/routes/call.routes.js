import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import { getIceServers } from "../controllers/call.controller.js";

const router = express.Router();

router.get("/ice-servers", protectRoute, getIceServers);

export default router;

import e from "express";
import protectRoute from "../middleware/protectRoute.js";
import { getIceServers } from "../controllers/call.controller.js";

const router = e.Router();

router.get("/ice-servers", protectRoute, getIceServers);

export default router;

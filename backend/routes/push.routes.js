import e from "express";
import protectRoute from "../middleware/protectRoute.js";
import { getPushConfig, subscribe, unsubscribe } from "../controllers/push.controller.js";

const router = e.Router();

router.get("/config", protectRoute, getPushConfig);
router.post("/subscribe", protectRoute, subscribe);
router.post("/unsubscribe", protectRoute, unsubscribe);

export default router;

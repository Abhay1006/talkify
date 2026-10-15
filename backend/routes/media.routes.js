import e from "express";
import { getMedia } from "../controllers/media.controller.js";
import protectRoute from "../middleware/protectRoute.js";

const router = e.Router();

router.get("/:id", protectRoute, getMedia);

export default router;

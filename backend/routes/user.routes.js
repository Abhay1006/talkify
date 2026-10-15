import e from "express";
import protectRoute from "../middleware/protectRoute.js";
import { uploadImage } from "../middleware/upload.js";
import { uploadLimiter } from "../middleware/rateLimit.js";
import {
  getAcceptedContacts, searchUsers, updateKeys, getMe, updateMe, updateAvatar, updateConversationPrefs,
} from "../controllers/user.controller.js";

const router = e.Router();

router.get("/", protectRoute, getAcceptedContacts);
router.get("/search", protectRoute, searchUsers);
router.put("/keys", protectRoute, updateKeys);
router.get("/me", protectRoute, getMe);
router.put("/me", protectRoute, updateMe);
router.post("/me/avatar", protectRoute, uploadLimiter, uploadImage, updateAvatar);
router.put("/prefs/:partnerId", protectRoute, updateConversationPrefs);

export default router;

import e from "express";
import protectRoute from "../middleware/protectRoute.js";
import { getAcceptedContacts, searchUsers, updateKeys } from "../controllers/user.controller.js";

const router=e.Router();

router.get("/",protectRoute,getAcceptedContacts);
router.get("/search",protectRoute,searchUsers);
router.put("/keys",protectRoute,updateKeys);

export default router;
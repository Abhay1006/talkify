/**
 * One-off migration: replaces avatars from the retired iran.liara.run service
 * with DiceBear URLs.
 *
 *   node backend/scripts/fix-avatars.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import { defaultAvatarUrl } from "../utils/avatar.js";

const run = async () => {
  await mongoose.connect(process.env.MONGO_DB_URI);
  console.log("Connected to MongoDB");

  const users = await User.find({ profilePic: /iran\.liara\.run/ });
  for (const user of users) {
    user.profilePic = defaultAvatarUrl(user.username, user.gender);
    await user.save();
  }

  console.log(`Updated ${users.length} users.`);
};

run()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  });

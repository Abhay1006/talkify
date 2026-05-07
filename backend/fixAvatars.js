import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/user.model.js";

dotenv.config();

mongoose.connect(process.env.MONGO_DB_URI).then(async () => {
  console.log("Connected to MongoDB");
  const users = await User.find();
  let count = 0;
  for (const user of users) {
    if (user.profilePic && user.profilePic.includes("iran.liara.run")) {
      const color = user.gender === "male" ? "b6e3f4" : "ffdfbf";
      user.profilePic = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}&backgroundColor=${color}`;
      await user.save();
      count++;
    }
  }
  console.log(`Updated ${count} users.`);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

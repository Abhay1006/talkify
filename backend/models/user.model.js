import mongoose from "mongoose";

// Case-insensitive comparison. Usernames are stored lowercase from now on, but
// accounts created earlier may contain capitals, so lookups use this collation
// instead of relying on the stored case.
export const USERNAME_COLLATION = { locale: "en", strength: 2 };

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    gender: {
      type: String,
      required: true,
      enum: ["male", "female"],
    },
    profilePic: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Serves login, signup duplicate checks and prefix search. Not unique: older
// data may already hold names that differ only by case, and a failed unique
// build would silently leave no index at all.
userSchema.index({ username: 1 }, { collation: USERNAME_COLLATION, name: "username_ci" });

const User = mongoose.model("User", userSchema);

export default User;

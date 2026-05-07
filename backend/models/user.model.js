import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
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
    bio: { type: String, default: '' },
    publicKey: { type: String, default: '' },
    lastSeen: { type: Date },
    isOnline: { type: Boolean, default: false },
    privacySettings: {
      allowAnonymousMessages: { type: Boolean, default: false },
      showLastSeen: { type: Boolean, default: true },
      showProfilePic: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' }
    }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;

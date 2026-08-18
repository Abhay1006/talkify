import mongoose from "mongoose";

const chatRequestSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    message: { type: String, default: '' },
  },
  { timestamps: true }
);

chatRequestSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });
chatRequestSchema.index({ receiverId: 1, status: 1 });

const ChatRequest = mongoose.model("ChatRequest", chatRequestSchema);

export default ChatRequest;

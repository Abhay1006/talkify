import multer from "multer";
import { MAX_UPLOAD_BYTES } from "../utils/imageProcessing.js";
import { MAX_VOICE_BYTES } from "../utils/audio.js";

// Uploads are held in memory: images are re-encoded straight away and voice
// notes go to media storage. Nothing touches the local disk (which on Render
// would not survive a deploy anyway).
const makeUpload = (field, maxBytes, tooLargeMessage) => {
  const single = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 4, fieldSize: 16 * 1024, parts: 5 },
  }).single(field);

  // Turns multer's errors into the JSON shape the client expects.
  return (req, res, next) => {
    single(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: tooLargeMessage });
        return res.status(400).json({ error: "Invalid upload" });
      }
      next(err);
    });
  };
};

export const uploadImage = makeUpload("image", MAX_UPLOAD_BYTES, "Images must be 2 MB or smaller");

export const uploadAudio = makeUpload("audio", MAX_VOICE_BYTES, "Voice messages must be 3 MB or smaller");


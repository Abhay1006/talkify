import multer from "multer";
import { MAX_UPLOAD_BYTES } from "../utils/imageProcessing.js";

// Held in memory: the file is re-encoded straight away and never touches the
// local disk (which on Render would not survive a deploy anyway).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    fields: 2,
    fieldSize: 16 * 1024,
    parts: 3,
  },
});

const single = upload.single("image");

// Turns multer's errors into the JSON shape the client expects.
const uploadImage = (req, res, next) => {
  single(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Images must be 2 MB or smaller" });
      }
      return res.status(400).json({ error: "Invalid upload" });
    }
    next(err);
  });
};

export default uploadImage;

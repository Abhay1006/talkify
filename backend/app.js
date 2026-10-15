import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.routes.js";
import messageRoutes from "./routes/message.routes.js";
import userRoutes from "./routes/user.routes.js";
import chatRequestRoutes from "./routes/chatRequest.routes.js";
import blockRoutes from "./routes/block.routes.js";
import mediaRoutes from "./routes/media.routes.js";
import callRoutes from "./routes/call.routes.js";
import pushRoutes from "./routes/push.routes.js";
import { apiLimiter, mediaLimiter } from "./middleware/rateLimit.js";
import { HttpError } from "./utils/httpError.js";
import { app, server, io } from "./socket/socket.js";

// Resolved from this file, not from process.cwd(), so the server finds the
// built frontend no matter which directory it is started from.
const frontendDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../frontend/dist");

// Render terminates TLS at its proxy. Without this, express-rate-limit sees
// every request as coming from the proxy IP and rate limits all users as one,
// and req.secure is never true.
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // MUI/emotion injects styles at runtime, so inline styles are required.
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://api.dicebear.com"],
        // 'self' covers same-origin ws:/wss: in every current browser. The
        // previous bare "ws: wss:" allowed sockets to any host at all.
        connectSrc: ["'self'"],
        mediaSrc: ["'self'", "data:", "blob:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    // Cross-origin isolation would block the dicebear avatars.
    crossOriginEmbedderPolicy: false,
  })
);

// Deliberately small. Image and voice uploads go through multipart (multer)
// on their own routes rather than being inflated ~33% into base64 JSON.
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());

app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat-requests", chatRequestRoutes);
app.use("/api/block", blockRoutes);
app.use("/api/media", mediaLimiter, mediaRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/push", pushRoutes);

// Registered before the SPA catch-all so an unmatched API route returns JSON.
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(express.static(frontendDist));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

// Turns anything a handler throws into a JSON error. Expected failures carry
// their own status; anything else is logged and reported as a plain 500.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: "Invalid id" });
  }
  // body-parser errors (malformed JSON, oversized body) are safe to show.
  if (err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export { app, server, io };

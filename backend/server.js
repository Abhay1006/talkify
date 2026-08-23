// Must be the first import: ES module imports are evaluated in source order
// before any statement in this file runs, so a later dotenv.config() call would
// leave process.env empty for modules that read it at module scope (socket.js).
import "dotenv/config";

import express from "express";
import path from "path";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import auhtRoutes from "./routes/auth.routes.js";
import messageRoutes from "./routes/message.routes.js";
import userRoutes from "./routes/user.routes.js";
import chatRequestRoutes from "./routes/chatRequest.routes.js";
import blockRoutes from "./routes/block.routes.js";
import connectToMongoDB from "./db/connectToMongoDB.js";
import { authLimiter, apiLimiter, searchLimiter } from "./middleware/rateLimit.js";
import { app, server } from "./socket/socket.js";

const port = process.env.PORT || 5001;
const __dirname = path.resolve();

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not set. Refusing to start.");
  process.exit(1);
}

// Render terminates TLS at its proxy. Without this, express-rate-limit sees
// every request as coming from the proxy IP and rate limits all users as one.
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // The UI ships one static stylesheet and no inline styles or webfonts,
        // so 'unsafe-inline' and the Google Fonts hosts are no longer needed.
        styleSrc: ["'self'"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        mediaSrc: ["'self'", "data:", "blob:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    // Left off: enabling it would require CORP headers on every subresource
    // for no benefit here.
    crossOriginEmbedderPolicy: false,
  })
);

// Deliberately small. Binary uploads will go through multipart in a later
// phase rather than being inflated into JSON.
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));
app.use(cookieParser());

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter, auhtRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users/search", searchLimiter);
app.use("/api/users", userRoutes);
app.use("/api/chat-requests", chatRequestRoutes);
app.use("/api/block", blockRoutes);

// Registered before the SPA catch-all so an unmatched API route returns JSON.
// Previously it fell through to index.html and the client threw an opaque
// "Unexpected token '<'" while parsing HTML as JSON.
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(express.static(path.join(__dirname, "/frontend/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

server.listen(port, () => {
  connectToMongoDB();
  console.log(`server running on port ${port}`);
});

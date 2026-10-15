// Must be the first import: ES module imports are evaluated in source order
// before any statement in this file runs, so a later dotenv.config() call would
// leave process.env empty for modules that read it at module scope (socket.js).
import "dotenv/config";

import mongoose from "mongoose";
import connectToMongoDB from "./db/connectToMongoDB.js";
import { server, io } from "./app.js";

const port = process.env.PORT || 5001;

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not set. Refusing to start.");
  process.exit(1);
}

// Connect first, then listen. Listening first meant a failed connection was
// only logged, and the server went on accepting requests that each hung for
// Mongoose's 10 second buffer timeout before failing.
try {
  await connectToMongoDB();
} catch (error) {
  console.error("FATAL: could not connect to MongoDB:", error.message);
  process.exit(1);
}

server.listen(port, () => {
  console.log(`server running on port ${port}`);
});

// Render sends SIGTERM on every deploy. Stop accepting connections, let
// in-flight requests finish, then close the database cleanly.
let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  // Force exit if something holds the process open.
  setTimeout(() => process.exit(1), 10_000).unref();

  io.close(() => {
    mongoose
      .disconnect()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

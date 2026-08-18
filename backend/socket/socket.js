import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

// Minimal Cookie-header parser. Socket.IO hands us the raw header and
// cookie-parser only runs on Express requests, so we read the one cookie we
// need here rather than taking a dependency for it.
const parseCookies = (header) => {
  const out = {};
  if (!header) return out;

  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;

    const name = part.slice(0, eq).trim();
    if (!name || name in out) continue; // first occurrence wins, per RFC 6265

    let value = part.slice(eq + 1).trim();
    if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    try {
      value = decodeURIComponent(value);
    } catch {
      // Malformed percent-encoding: keep the raw value; jwt.verify will reject
      // it if it is not a real token anyway.
    }
    out[name] = value;
  }
  return out;
};

const app = express();

const server = http.createServer(app);

// In production the SPA is served from this same origin, so no cross-origin
// allowance is needed. In development Vite runs on :3000. Extra origins can be
// added via CLIENT_ORIGINS (comma separated).
const allowedOrigins = [
  ...(process.env.NODE_ENV === "development" ? ["http://localhost:3000"] : []),
  ...(process.env.CLIENT_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? []),
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : false,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Identity comes from the signed JWT cookie only. It must never be read from
// the handshake query: that is client-controlled, so anyone could claim to be
// any user and receive their messages.
io.use(async (socket, next) => {
  try {
    const rawCookie = socket.handshake.headers.cookie;
    if (!rawCookie) return next(new Error("unauthorized"));

    const { jwt: token } = parseCookies(rawCookie);
    if (!token) return next(new Error("unauthorized"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("_id");
    if (!user) return next(new Error("unauthorized"));

    socket.userId = user._id.toString();
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

// userId -> Set of socket ids. A user may have several tabs or devices open at
// once, so presence only drops when the last of them disconnects.
const userSockets = new Map();

export const getReceiverSocketIds = (receiverId) => {
  return [...(userSockets.get(receiverId?.toString()) ?? [])];
};

export const isUserOnline = (userId) => userSockets.has(userId?.toString());

export const emitToUser = (userId, event, payload) => {
  for (const socketId of getReceiverSocketIds(userId)) {
    io.to(socketId).emit(event, payload);
  }
};

const broadcastOnlineUsers = () => {
  io.emit("getOnlineUsers", [...userSockets.keys()]);
};

io.on("connection", (socket) => {
  const { userId } = socket;

  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socket.id);

  broadcastOnlineUsers();

  socket.on("disconnect", () => {
    const sockets = userSockets.get(userId);
    if (!sockets) return;

    sockets.delete(socket.id);
    if (sockets.size === 0) userSockets.delete(userId);

    broadcastOnlineUsers();
  });
});

export { app, io, server };

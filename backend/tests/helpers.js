// Test helpers: boot a real server process against a throwaway database and
// talk to it over HTTP and Socket.IO, exactly as the browser does.
import { spawn } from "child_process";
import crypto from "crypto";
import { io as connectSocket } from "socket.io-client";

const MONGO_BASE = process.env.TEST_MONGO_URI ?? "mongodb://127.0.0.1:27017";

export const startServer = (env = {}) =>
  new Promise((resolve, reject) => {
    const port = 20000 + Math.floor(Math.random() * 20000);
    const dbName = `talkify_test_${crypto.randomBytes(4).toString("hex")}`;
    const child = spawn(process.execPath, ["backend/server.js"], {
      env: {
        ...process.env,
        PORT: String(port),
        MONGO_DB_URI: `${MONGO_BASE}/${dbName}`,
        JWT_SECRET: "test-secret",
        NODE_ENV: "test",
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const timer = setTimeout(() => reject(new Error(`server did not start:\n${output}`)), 15000);
    const onData = (chunk) => {
      output += chunk;
      if (output.includes("connected to mongodb")) {
        clearTimeout(timer);
        resolve({
          url: `http://127.0.0.1:${port}`,
          logs: () => output,
          stop: () => new Promise((r) => { child.once("exit", r); child.kill(); }),
        });
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => reject(new Error(`server exited (${code}):\n${output}`)));
  });

let counter = 0;

export const signup = async (url, name = "user") => {
  const username = `${name}${Date.now()}${counter++}`;
  const res = await fetch(`${url}/api/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName: name, username, password: "secret123", confirmPassword: "secret123", gender: "female" }),
  });
  if (!res.ok) throw new Error(`signup failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return { id: body._id, username, cookie: res.headers.get("set-cookie").split(";")[0] };
};

export const api = (url, user, path, { method = "GET", body } = {}) =>
  fetch(`${url}${path}`, {
    method,
    headers: { cookie: user.cookie, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

/** Makes two users accepted contacts, the precondition for calling. */
export const befriend = async (url, a, b) => {
  await api(url, a, `/api/messages/send/${b.id}`, { method: "POST", body: { message: "hi" } });
  const pending = await (await api(url, b, "/api/chat-requests/pending")).json();
  const request = pending.find((r) => (r.senderId?._id ?? r.senderId) === a.id);
  const res = await api(url, b, `/api/chat-requests/${request._id}/accept`, { method: "PUT" });
  if (!res.ok) throw new Error(`accept failed: ${res.status}`);
};

const sockets = new Set();

export const connect = (url, user) =>
  new Promise((resolve, reject) => {
    const socket = connectSocket(url, {
      transports: ["websocket"],
      extraHeaders: { cookie: user.cookie },
      reconnection: false,
      forceNew: true,
    });
    sockets.add(socket);
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });

export const closeAllSockets = () => {
  for (const s of sockets) s.close();
  sockets.clear();
};

export const emit = (socket, event, payload, timeout = 3000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ack for ${event}`)), timeout);
    socket.emit(event, payload, (reply) => {
      clearTimeout(timer);
      resolve(reply);
    });
  });

export const waitFor = (socket, event, { timeout = 3000, where = () => true } = {}) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timed out waiting for ${event}`));
    }, timeout);
    const handler = (payload) => {
      if (!where(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });

/** Resolves true if `event` does NOT arrive within `ms`. */
export const staysQuiet = (socket, event, ms = 400) =>
  new Promise((resolve) => {
    const handler = () => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(false);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(true);
    }, ms);
    socket.on(event, handler);
  });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

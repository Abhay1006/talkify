import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Rate limits are stored in memory, which means they reset on restart and are
// per-instance. That is fine for a single Render dyno; if this ever scales to
// more than one instance, swap in a shared store (Redis) so the limits are
// actually global.
const baseOptions = {
  // The integration tests make far more requests than any limit allows.
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again shortly." },
};

// Login and signup. Deliberately tight: without this, the 6-character minimum
// password can be brute forced at network speed. See docs/V2-REDESIGN.md §3.4.
export const authLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});

// Broad backstop for everything under /api. Media reads have their own budget
// below: a chat full of images would otherwise burn through this one.
export const apiLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 300,
  skip: (req) => baseOptions.skip() || (req.method === "GET" && req.path.startsWith("/media/")),
});

// Image reads. Browser caching keeps repeat views off this budget.
export const mediaLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 600,
});

// Search hits a regex query, so it gets a tighter budget than general reads.
export const searchLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 30,
});

// Generous enough for fast typing, low enough to stop a flood script. Keyed by
// account rather than IP (it runs after protectRoute), so people behind one
// shared NAT or office network do not share a single budget.
export const messageLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: (req) => req.user?._id?.toString() ?? ipKeyGenerator(req.ip),
  message: { error: "You are sending messages too quickly." },
});

// Image uploads cost a decode and two re-encodes each, so they get a much
// tighter budget than text messages (which they also count against). Per
// account, like messageLimiter.
export const uploadLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 15,
  keyGenerator: (req) => req.user?._id?.toString() ?? ipKeyGenerator(req.ip),
  message: { error: "You are uploading too quickly. Please wait a moment." },
});

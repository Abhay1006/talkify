import rateLimit from "express-rate-limit";

// Rate limits are stored in memory, which means they reset on restart and are
// per-instance. That is fine for a single Render dyno; if this ever scales to
// more than one instance, swap in a shared store (Redis) so the limits are
// actually global.
const baseOptions = {
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

// Broad backstop for everything under /api.
export const apiLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 300,
});

// Search hits a regex query, so it gets a tighter budget than general reads.
export const searchLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 30,
});

// Generous enough for fast typing, low enough to stop a flood script.
export const messageLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 60,
  message: { error: "You are sending messages too quickly." },
});

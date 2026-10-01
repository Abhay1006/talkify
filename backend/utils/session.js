import jwt from "jsonwebtoken";

export const SESSION_COOKIE = "jwt";
const SESSION_TTL_SECONDS = 15 * 24 * 60 * 60;

// `secure` follows the actual request rather than NODE_ENV. Behind Render's
// TLS proxy (with `trust proxy` set) req.secure is true; on plain-http
// localhost it is false. Keying it off NODE_ENV meant a forgotten
// NODE_ENV=development locally produced a cookie the browser silently dropped,
// so login "worked" and then every API call returned 401.
const cookieOptions = (req) => ({
  httpOnly: true,
  sameSite: "strict",
  secure: req.secure,
  path: "/",
});

export const setSessionCookie = (req, res, userId) => {
  const token = jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: SESSION_TTL_SECONDS,
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(req), maxAge: SESSION_TTL_SECONDS * 1000 });
};

// Must be cleared with the same attributes it was set with, or some browsers
// keep the original cookie.
export const clearSessionCookie = (req, res) => {
  res.clearCookie(SESSION_COOKIE, cookieOptions(req));
};

// Returns the decoded payload, or null for a missing, malformed, tampered or
// expired token.
export const decodeSessionToken = (token) => {
  if (typeof token !== "string" || !token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    return typeof decoded?.userId === "string" ? decoded : null;
  } catch {
    return null;
  }
};

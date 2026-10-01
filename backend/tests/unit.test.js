// Pure-function tests. These need no database and always run.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ??= "unit-test-secret";

const { participantsKeyFor } = await import("../models/conversation.model.js");
const { defaultAvatarUrl } = await import("../utils/avatar.js");
const { decodeSessionToken } = await import("../utils/session.js");
const { USERNAME_PATTERN } = await import("../controllers/auth.controller.js");
const jwt = (await import("jsonwebtoken")).default;

test("participantsKeyFor is order independent", () => {
  assert.equal(participantsKeyFor("b", "a"), participantsKeyFor("a", "b"));
  assert.equal(participantsKeyFor("a", "b"), "a:b");
});

test("defaultAvatarUrl encodes the username", () => {
  assert.match(defaultAvatarUrl("a&b", "male"), /seed=a%26b&backgroundColor=b6e3f4$/);
});

test("decodeSessionToken rejects missing, tampered and expired tokens", () => {
  const valid = jwt.sign({ userId: "u1" }, process.env.JWT_SECRET);
  assert.equal(decodeSessionToken(valid).userId, "u1");

  assert.equal(decodeSessionToken(undefined), null);
  assert.equal(decodeSessionToken({ $ne: null }), null);
  assert.equal(decodeSessionToken(jwt.sign({ userId: "u1" }, "wrong-secret")), null);
  assert.equal(decodeSessionToken(jwt.sign({ userId: "u1" }, process.env.JWT_SECRET, { expiresIn: -10 })), null);
  // "none" algorithm tokens must never verify.
  assert.equal(decodeSessionToken(jwt.sign({ userId: "u1" }, null, { algorithm: "none" })), null);
});

test("USERNAME_PATTERN", () => {
  for (const ok of ["abc", "john_doe", "j.d.99", "a".repeat(20)]) assert.ok(USERNAME_PATTERN.test(ok), ok);
  for (const bad of ["ab", "John", "has space", "a".repeat(21), "x$y"]) assert.ok(!USERNAME_PATTERN.test(bad), bad);
});

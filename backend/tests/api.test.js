// Integration tests against a real MongoDB. Set MONGO_TEST_URI to run them,
// e.g. mongodb://127.0.0.1:27017 (CI provides one). The database used is
// created for the run and dropped afterwards.
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET ??= "integration-test-secret";

const MONGO_TEST_URI = process.env.MONGO_TEST_URI;
const skip = MONGO_TEST_URI ? false : "MONGO_TEST_URI is not set";

describe("API", { skip }, () => {
  let request, mongoose, app, Message, Conversation, User;

  before(async () => {
    mongoose = (await import("mongoose")).default;
    request = (await import("supertest")).default;
    ({ app } = await import("../app.js"));
    Message = (await import("../models/message.model.js")).default;
    Conversation = (await import("../models/conversation.model.js")).default;
    User = (await import("../models/user.model.js")).default;

    await mongoose.connect(MONGO_TEST_URI, { dbName: `talkify_test_${process.pid}_${Date.now()}` });
    await mongoose.connection.syncIndexes();
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  });

  // Signs a user up and returns an agent that carries their session cookie.
  const signup = async (username, overrides = {}) => {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/signup").send({
      fullName: `User ${username}`,
      username,
      password: "secret123",
      confirmPassword: "secret123",
      gender: "female",
      ...overrides,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return { agent, user: res.body };
  };

  const send = (agent, to, message = "hello") => agent.post(`/api/messages/send/${to._id}`).send({ message });
  const contactsOf = async (agent) => (await agent.get("/api/users")).body;

  describe("auth", () => {
    test("signup stores a lowercase username and never sets a session on failure", async () => {
      const { user } = await signup("alice");
      assert.equal(user.username, "alice");

      const dup = await request(app).post("/api/auth/signup").send({
        fullName: "Other",
        username: "ALICE",
        password: "secret123",
        confirmPassword: "secret123",
        gender: "male",
      });
      assert.equal(dup.status, 409);
      assert.equal(dup.headers["set-cookie"], undefined);
    });

    test("signup validates every field on the server", async () => {
      const base = {
        fullName: "A",
        username: "valid_name",
        password: "secret123",
        confirmPassword: "secret123",
        gender: "male",
      };
      const cases = [
        { username: "no spaces" },
        { username: "ab" },
        { password: "123", confirmPassword: "123" },
        { password: "x".repeat(73), confirmPassword: "x".repeat(73) },
        { confirmPassword: "different" },
        { gender: "other" },
        { fullName: "x".repeat(51) },
        { username: { $ne: null } },
      ];
      for (const override of cases) {
        const res = await request(app)
          .post("/api/auth/signup")
          .send({ ...base, ...override });
        assert.equal(res.status, 400, JSON.stringify(override));
      }
    });

    test("login is case-insensitive and rejects operator injection", async () => {
      await signup("bob");

      const ok = await request(app).post("/api/auth/login").send({ username: "BOB", password: "secret123" });
      assert.equal(ok.status, 200);

      const injected = await request(app)
        .post("/api/auth/login")
        .send({ username: { $ne: null }, password: "secret123" });
      assert.equal(injected.status, 400);

      const wrong = await request(app).post("/api/auth/login").send({ username: "bob", password: "nope" });
      assert.equal(wrong.status, 400);
    });

    test("legacy mixed-case accounts can still log in", async () => {
      const { agent } = await signup("carol");
      await User.updateOne({ username: "carol" }, { $set: { username: "Carol" } });
      await agent.post("/api/auth/logout");

      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "carol", password: "secret123" });
      assert.equal(res.status, 200);
    });

    test("/me needs a valid session, and a deleted account gets 401", async () => {
      assert.equal((await request(app).get("/api/auth/me")).status, 401);

      const { agent, user } = await signup("dave");
      const me = await agent.get("/api/auth/me");
      assert.equal(me.status, 200);
      assert.equal(me.body.username, "dave");
      assert.equal(me.body.password, undefined);

      await User.deleteOne({ _id: user._id });
      assert.equal((await agent.get("/api/auth/me")).status, 401);
    });

    test("logout clears the cookie", async () => {
      const { agent } = await signup("erin");
      await agent.post("/api/auth/logout").expect(200);
      assert.equal((await agent.get("/api/auth/me")).status, 401);
    });
  });

  describe("chat requests are enforced by the server", () => {
    test("one opening message, then nothing until the receiver accepts", async () => {
      const a = await signup("sender");
      const b = await signup("receiver");

      assert.equal((await send(a.agent, b.user, "hi")).status, 201);
      assert.equal((await send(a.agent, b.user, "hi again")).status, 403);
      assert.equal((await send(b.agent, a.user, "reply")).status, 403);

      const [contact] = await contactsOf(b.agent);
      assert.equal(contact.requestStatus, "pending");
      assert.equal(contact.requestSenderId, a.user._id);

      await b.agent.put(`/api/chat-requests/${contact.requestId}/accept`).expect(200);
      // Cannot be answered twice.
      assert.equal((await b.agent.put(`/api/chat-requests/${contact.requestId}/reject`)).status, 409);

      assert.equal((await send(a.agent, b.user)).status, 201);
      assert.equal((await send(b.agent, a.user)).status, 201);
    });

    test("only the receiver can answer a request", async () => {
      const a = await signup("sender2");
      const b = await signup("receiver2");
      await send(a.agent, b.user);
      const [contact] = await contactsOf(b.agent);

      assert.equal((await a.agent.put(`/api/chat-requests/${contact.requestId}/accept`)).status, 403);
      assert.equal((await b.agent.put(`/api/chat-requests/not-an-id/accept`)).status, 400);
    });

    test("a decline hides the sender from the receiver and looks pending to the sender", async () => {
      const a = await signup("hopeful");
      const b = await signup("declines");
      await send(a.agent, b.user);
      const [contact] = await contactsOf(b.agent);

      await b.agent.put(`/api/chat-requests/${contact.requestId}/reject`).expect(200);

      assert.deepEqual(await contactsOf(b.agent), []);
      const [seenBySender] = await contactsOf(a.agent);
      assert.equal(seenBySender.requestStatus, "pending");

      const retry = await send(a.agent, b.user);
      assert.equal(retry.status, 403);
      assert.equal(retry.body.error, "Your message request hasn't been accepted yet");
    });

    test("conversations from before chat requests existed keep working", async () => {
      const a = await signup("old_a");
      const b = await signup("old_b");
      await Conversation.create({ participants: [a.user._id, b.user._id] });

      assert.equal((await send(a.agent, b.user)).status, 201);
      assert.equal((await send(b.agent, a.user)).status, 201);
    });

    test("simultaneous first messages create one conversation", async () => {
      const a = await signup("racer_a");
      const b = await signup("racer_b");

      const results = await Promise.all([
        send(a.agent, b.user),
        send(a.agent, b.user),
        send(a.agent, b.user),
      ]);
      assert.equal(results.filter((r) => r.status === 201).length, 1);
      assert.equal(await Conversation.countDocuments(), 1);
    });
  });

  describe("blocking", () => {
    const connect = async (nameA, nameB) => {
      const a = await signup(nameA);
      const b = await signup(nameB);
      await send(a.agent, b.user);
      const [contact] = await contactsOf(b.agent);
      await b.agent.put(`/api/chat-requests/${contact.requestId}/accept`).expect(200);
      return { a, b };
    };

    test("blocks both directions and hides both sides", async () => {
      const { a, b } = await connect("blocker", "blocked");

      await a.agent.post(`/api/block/${b.user._id}`).expect(200);
      assert.equal((await a.agent.post(`/api/block/${b.user._id}`)).status, 409);

      assert.equal((await send(a.agent, b.user)).status, 403);
      assert.equal((await send(b.agent, a.user)).status, 403);
      assert.equal((await b.agent.get(`/api/messages/${a.user._id}`)).status, 403);
      assert.deepEqual(await contactsOf(a.agent), []);
      assert.deepEqual(await contactsOf(b.agent), []);

      await a.agent.delete(`/api/block/${b.user._id}`).expect(200);
      assert.equal((await send(b.agent, a.user)).status, 201);
    });

    test("rejects bad targets", async () => {
      const { a } = await connect("x_user", "y_user");
      assert.equal((await a.agent.post(`/api/block/${a.user._id}`)).status, 400);
      assert.equal((await a.agent.post(`/api/block/nope`)).status, 400);
      assert.equal((await a.agent.post(`/api/block/${new mongoose.Types.ObjectId()}`)).status, 404);
    });
  });

  describe("messages", () => {
    test("are paginated newest page first, oldest first within a page", async () => {
      const a = await signup("pager_a");
      const b = await signup("pager_b");
      await Conversation.create({ participants: [a.user._id, b.user._id] });
      await Message.insertMany(
        Array.from({ length: 60 }, (_, i) => ({
          senderId: a.user._id,
          receiverId: b.user._id,
          body: `m${i}`,
        }))
      );

      const first = await b.agent.get(`/api/messages/${a.user._id}`).expect(200);
      assert.equal(first.body.messages.length, 50);
      assert.equal(first.body.messages[0].body, "m10");
      assert.equal(first.body.messages.at(-1).body, "m59");
      assert.ok(first.body.nextCursor);

      const second = await b.agent
        .get(`/api/messages/${a.user._id}?before=${first.body.nextCursor}`)
        .expect(200);
      assert.deepEqual(
        second.body.messages.map((m) => m.body),
        Array.from({ length: 10 }, (_, i) => `m${i}`)
      );
      assert.equal(second.body.nextCursor, null);

      assert.equal((await b.agent.get(`/api/messages/${a.user._id}?before=bad`)).status, 400);
    });

    test("validate the body", async () => {
      const a = await signup("valid_a");
      const b = await signup("valid_b");
      assert.equal((await send(a.agent, b.user, "   ")).status, 400);
      assert.equal((await send(a.agent, b.user, "x".repeat(4001))).status, 400);
      assert.equal(
        (await a.agent.post(`/api/messages/send/${b.user._id}`).send({ message: { $gt: "" } })).status,
        400
      );
      assert.equal((await send(a.agent, a.user)).status, 400);
    });
  });

  describe("search", () => {
    test("is a case-insensitive prefix match that excludes yourself and blocks", async () => {
      const me = await signup("searcher");
      await signup("target_one");
      const two = await signup("target_two");
      await signup("other");
      await User.updateOne({ username: "other" }, { $set: { username: "Target_Legacy" } });

      await me.agent.post(`/api/block/${two.user._id}`).expect(200);

      const res = await me.agent.get(`/api/users/search?q=${encodeURIComponent("TARGET")}`).expect(200);
      assert.deepEqual(res.body.map((u) => u.username).sort(), ["Target_Legacy", "target_one"]);
      assert.equal(res.body[0].password, undefined);

      assert.equal((await me.agent.get("/api/users/search?q=se")).status, 400);
      assert.equal((await me.agent.get("/api/users/search?q[$ne]=x")).status, 400);
      // Regex metacharacters are plain text.
      assert.deepEqual((await me.agent.get(`/api/users/search?q=${encodeURIComponent(".*+")}`)).body, []);
    });
  });

  describe("errors", () => {
    test("unknown API routes and malformed JSON return JSON errors", async () => {
      const notFound = await request(app).get("/api/does-not-exist");
      assert.equal(notFound.status, 404);
      assert.equal(notFound.body.error, "Not found");

      const malformed = await request(app)
        .post("/api/auth/login")
        .set("Content-Type", "application/json")
        .send("{not json");
      assert.equal(malformed.status, 400);
      assert.ok(malformed.body.error);
    });
  });
});

# Talkify v2 — Redesign & Feature Plan

**Status:** Draft for approval · **Branch:** `v2-development` · **Written:** 2026-08-17

This document covers four things:

1. An audit of the current codebase — **bugs and security issues found** (§2, §3)
2. The **new identity model** — accounts with no login, friends connect by user ID (§4)
3. The **minimal design system** with dark and light mode (§5)
4. **New features** — voice calls, video calls, image messages, and a ranked list of the rest (§6–§8)

Then the data/API changes (§9–§11), a phased implementation plan (§12), and the decisions I need from you (§13).

---

## 1. Where the project stands today

Talkify is a 1:1 real-time chat app. React 18 + MUI 9 + Zustand + React Query on the front, Express + Socket.IO + MongoDB on the back, deployed as a single Node process on Render that also serves the built frontend.

What already works well and should be kept:

- The **chat-request model** (you must be accepted before a conversation opens) is a genuinely good anti-spam primitive. It survives into v2 largely unchanged.
- **React Query** for server state and **Zustand** for UI state is the right split.
- The **mobile layout work** on `v2-development` (safe-area insets, `dvh` heights, 44px touch targets, sidebar/thread swap on small screens) is solid and carries forward.
- Block lists, privacy settings, and presence fields already exist in the schema.

What has to change: the visual language (heavy glassmorphism over a background image), the auth model (per your request), and a fairly long list of correctness and security problems documented below.

**One thing to know before reading further:** the app currently advertises itself as *"Talkify Secure Messaging"* and stores every message in a field called `ciphertext`, but **no encryption exists anywhere in the codebase**. Details in §3.2. This is the most important finding in this document.

---

## 2. Bugs found

Ordered roughly by how much they hurt. File references are `path:line`.

### 2.1 Presence breaks with more than one tab

`backend/socket/socket.js:19,33` — `userSocketMap` maps one userId to exactly one socket id. Open the app in two tabs and the second overwrites the first. Close either tab and `delete userSocketMap[userId]` wipes the entry, so you appear offline while still connected, and messages route to a dead socket.

**Fix:** map userId → `Set<socketId>`; only remove presence when the set empties.

### 2.2 Real-time is dead in production

`backend/socket/socket.js:10` hardcodes the CORS origin to `http://localhost:3000`, and `frontend/src/context/SocketContext.jsx:18` hardcodes the client to `http://localhost:5001`. On Render, the socket connection fails and the app silently degrades to "messages only appear after refresh." There is no error surfaced to the user.

**Fix:** same-origin socket connection in production (`io()` with no URL), env-driven origin allowlist on the server.

### 2.3 Tailwind is not installed, but the CSS uses it

`frontend/src/index.css:1-3` has `@tailwind base/components/utilities`, and lines 109 and 113 use `@apply`. There is no `tailwindcss` package and no `postcss.config.js`. **These rules compile to nothing** — `.btn-primary-premium` and `.input-premium` are no-op class names. Dead code that looks live.

**Fix:** delete it. v2 is MUI-only; the whole file gets rewritten anyway (§5).

### 2.4 PWA support is claimed but not wired up

`vite-plugin-pwa` and `workbox-window` are in `frontend/package.json`, the README advertises PWA support, and `frontend/vite.config.js` registers only `react()`. There is no manifest, no service worker, no install prompt.

**Fix:** either wire it up (§7, Tier 2) or drop the deps and the README claim. I'd wire it up — it's cheap and a chat app benefits a lot from it.

### 2.5 Message list race between React Query and sockets

`useGetMessages.jsx` pushes query results into Zustand with `setMessages(data)`. `useListenMessages.js` and `useSendMessages.js` independently do `setMessages([...messages, newMessage])`. A refetch that lands after a socket message silently discards it. Two sources of truth for the same array.

**Fix:** one source of truth. Keep messages in the React Query cache and mutate it via `setQueryData`; Zustand holds only `selectedConversation` and UI state.

### 2.6 Socket listener re-subscribes on every message

`useListenMessages.js:29` — the effect lists `messages` as a dependency, so every incoming message tears down and re-registers the handler. `socket.off("newMessage")` with no handler argument removes *all* listeners for that event, which will silently break the moment a second feature listens to it. Under React StrictMode's double-invoke this is also a duplicate-message risk.

### 2.7 Unhandled promise rejection on notification sound

`useListenMessages.js:18` — `sound.play()` returns a promise that rejects whenever browser autoplay policy blocks it (i.e. before the user has interacted with the page). Console noise on every message for new visitors.

**Fix:** `.catch(() => {})`, and preload one `Audio` instance instead of constructing a new one per message.

### 2.8 `lastMessageRef` is attached to every message

`frontend/src/components/messages/Messages.jsx:34` — the ref is set inside `.map()`, so all messages write to it and the last one wins. It works by accident. Scroll-to-bottom should use a dedicated sentinel element or the scroll container.

### 2.9 Unmatched API routes return HTML

`backend/server.js:29` — `app.get("*")` sits after the API routes and returns `index.html` for anything unmatched, *including* `/api/typo`. The client then calls `res.json()` on an HTML document and throws `Unexpected token '<'`, which is a miserable error to debug.

**Fix:** a `/api/*` 404 JSON handler registered before the SPA catch-all.

### 2.10 Chat header always says "Online"

`MessageContainer.jsx` renders a hardcoded `Online` label regardless of `onlineUsers`. `Conversation.jsx` does this correctly — the header just never got wired.

### 2.11 N+1 query when loading the contact list

`user.controller.js` `getAcceptedContacts` loops over every contact and runs a separate `ChatRequest.findOne` for each. One `$in` query would do.

### 2.12 Assorted smaller issues

| Where | Issue |
|---|---|
| `App.jsx`, `Login.jsx`, `Signup.jsx` | Duplicate `height`/`minHeight` keys in the same `sx` object — the `100vh` fallback is silently dropped by the object literal, only `100dvh` survives |
| `Conversations.jsx` | Passes a `lastIdx` prop that `Conversation` never reads |
| `message.controller.js` | `receiverId` isn't validated as an ObjectId — a malformed id throws a CastError and returns 500 instead of 400 |
| `block.controller.js` | Nothing stops you from blocking yourself; `BlockList` has no compound unique index, so concurrent requests can create duplicate rows |
| `protectRoute.js` | `if (!decoded)` is dead code — `jwt.verify` throws on failure, it never returns falsy |
| `package.json` (root + frontend) | Self-referential deps: `"chat-app": "file:"`, `"frontend": "file:"`, `"chat-app": "file:.."`. Cruft that confuses fresh installs |
| `user.model.js` | `gender` is required and enum `['male','female']` — used only to pick an avatar background colour. Removed in v2 (§4) |
| `useSendMessages.js` | Sends `{ message }`; the `ciphertext`/`iv`/`senderPublicKey` path is never exercised by any client code |

---

## 3. Security issues

Severity is my assessment of impact on a real deployment with real users.

### 3.1 🔴 CRITICAL — Socket.IO has no authentication

```js
// backend/socket/socket.js:24-25
const userId = socket.handshake.query.userId;
if (userId != "undefined") userSocketMap[userId] = socket.id;
```

The user's identity comes from **an unauthenticated query string**. The JWT cookie is never checked on the socket handshake.

Anyone can open a socket with `?userId=<victim's ObjectId>` and the server will register them as that user. Because `sendMessage` delivers via `io.to(getReceiverSocketId(receiverId))`, **the attacker now receives the victim's incoming messages in real time.** It also evicts the victim from the presence map, and lets an attacker fake anyone as online.

User IDs are not secret — they're returned by `/api/users/search` to any logged-in user. So this is exploitable by any registered account against any other account, with no special access.

**Fix:** parse and verify the `jwt` cookie in a Socket.IO middleware (`io.use(...)`), derive `socket.userId` from the verified token only, and reject the connection otherwise. Never read identity from the handshake query. This is the single most important fix in this document and should land before anything else.

### 3.2 🔴 CRITICAL — The encryption is fake, and the UI claims it's real

```js
// backend/controllers/message.controller.js:37-46
const finalCiphertext = ciphertext || message || "encrypted";
const finalIv = iv || "default-iv";
// ...
senderPublicKey: senderPublicKey || "default-key",
```

The schema has `ciphertext`, `iv`, and `senderPublicKey`. The client never populates any of them — it posts `{ message: "<plaintext>" }`. So every message is **stored in plaintext in MongoDB, in a column named `ciphertext`, with the literal string `"default-iv"` as its initialization vector.** `Message.jsx` renders `message.message || message.ciphertext`, which works precisely because there is no encryption.

Meanwhile the empty state renders a green dot and the words **"Talkify Secure Messaging"**, and the message-request panel shows a shield icon.

Two independent problems:

- **Technical:** messages are plaintext at rest. Anyone with DB access — you, a contractor, an attacker with a leaked `MONGO_DB_URI`, or MongoDB Atlas support — reads every conversation.
- **Trust:** the app tells users their messages are secure when they are not. If someone shares something sensitive because of that claim, the claim caused the harm. This matters more than the technical issue.

**Fix, in order:**
1. **Immediately:** remove the "Secure Messaging" claim and the shield iconography, or reword to something true ("Encrypted in transit"). Do this in Phase 0, before any redesign work.
2. Rename the schema fields to `body`/`type` so the code stops lying about what it holds.
3. If you want real E2E later, it's Tier 3 (§7) and it is a real project — see the note there about how it conflicts with server-side image processing and link previews.

### 3.3 🔴 CRITICAL — Blocking does not block

`sendMessage` in `message.controller.js` never consults `BlockList`, and never checks `conversation.status === 'blocked'`. Block someone and they can keep sending you messages; the socket delivers them and they appear in your thread. `getMessages` has the same gap on the read side.

For a feature whose entire purpose is safety, silently not working is worse than not existing — a user who blocks a harasser believes they're protected.

**Fix:** a shared `assertCanMessage(senderId, receiverId)` guard used by `sendMessage`, `getMessages`, and every call-signaling event (§8). Check both directions of the block list.

### 3.4 🟠 HIGH — No rate limiting anywhere

No limiter on any route. Specifically:

- `POST /api/auth/login` accepts unlimited password guesses against 6-character-minimum passwords. That's an offline-speed online brute force.
- `GET /api/users/search` runs an unanchored regex scan over the whole users collection, unthrottled.
- `POST /api/messages/send/:id` has no flood control.

**Fix:** `express-rate-limit` with a strict bucket on auth, a moderate one on search, and a per-conversation message limiter. Once the v2 identity model lands (§4) the login brute-force surface disappears, but the others remain.

### 3.5 🟠 HIGH — Regex injection / ReDoS in user search

```js
// backend/controllers/user.controller.js:71
username: { $regex: query, $options: 'i' }
```

Raw user input goes straight into a regex. A query like `(a+)+$` triggers catastrophic backtracking and pins a MongoDB thread. Combined with §3.4, one unauthenticated-ish user can degrade the database for everyone.

**Fix:** escape regex metacharacters and anchor the pattern (`^escaped`), or switch to a MongoDB text index. Anchoring also makes the query indexable, which fixes the performance problem at the same time.

### 3.6 🟠 HIGH — User search leaks full user documents

`.select('-password')` strips exactly one field. Search results therefore include `publicKey`, the entire `privacySettings` object, `lastSeen`, `isOnline`, and `createdAt` — for **any user matching a 3-character substring**, including people who have blocked you. `showLastSeen: false` and `showProfilePic: 'nobody'` are stored but never enforced.

**Fix:** explicit allowlist projection (`_id`, `talkId`, `displayName`, `avatarUrl`), and enforce `privacySettings` server-side rather than storing them decoratively.

### 3.7 🟠 HIGH — No security headers, no Express CORS policy

No `helmet`. No CSP, no `X-Content-Type-Options`, no `Referrer-Policy`, no HSTS. CORS is configured on Socket.IO only — the Express API has no CORS middleware at all (it works today only because the SPA is same-origin).

**Fix:** `helmet` with a CSP tuned for MUI's emotion styles, plus an explicit env-driven origin allowlist. The CSP needs care once images come from Cloudinary (§6) and WebRTC connects to TURN (§8).

### 3.8 🟡 MEDIUM — Client trusts localStorage for identity

`AuthContext.jsx` reads `chat-user` from localStorage and treats its presence as "logged in". There is no `/api/auth/me` endpoint and no session validation on boot, so the UI renders a logged-in shell until the first API call happens to 401. `frontend/src/api/client.js` handles that 401 correctly (good — that's what commit `4672cd0` added), but the app still flashes authenticated state first.

**Fix:** a `GET /api/auth/me` call on boot with a proper loading state. Also relevant to §4 — the v2 device-secret model needs a real session bootstrap anyway.

### 3.9 🟡 MEDIUM — Cookie policy blocks split-domain deployment

`generateToken.js` sets `sameSite: "strict"`. That's a fine CSRF defence for the current same-origin setup, but it means the cookie will not be sent if you ever host the frontend on a separate domain (Vercel + Render, a custom domain, etc.). Worth deciding deliberately rather than discovering during a deploy.

There is also no CSRF token — currently mitigated entirely by `sameSite: strict`. If that setting ever loosens to `none` for a split deployment, **CSRF protection must be added in the same change**.

### 3.10 🟡 MEDIUM — No pagination, unbounded document growth

`getMessages` loads and populates every message in a conversation, forever. Separately, `Conversation.messages` is an unbounded array of ObjectIds inside a single document — a long-running chat will eventually hit MongoDB's 16 MB per-document limit and start failing writes with no graceful path.

**Fix:** cursor pagination (50 per page), and drop the `messages` array entirely — query the `Message` collection by conversation id with a compound index. The array is redundant with the collection.

### 3.11 🟡 MEDIUM — Missing indexes

No index on `Message.senderId`/`receiverId`, `Conversation.participants`, or any `ChatRequest` field. Every conversation load and every contact-list build is a collection scan.

### 3.12 ✅ Checked and clean

- `.env` is correctly gitignored and **has never been committed** — I checked the full history across all branches. Nothing to rotate on that front.
- Passwords use bcrypt with a proper per-password salt at cost 10. Correct.
- Login returns an identical error for unknown username and wrong password, so it doesn't leak which usernames exist.
- `acceptChatRequest` and `rejectChatRequest` both verify the caller is the receiver before mutating.
- The JWT cookie is `httpOnly`, and `secure` outside development.

---

## 4. New identity model — accounts with no login

> Your request: *"lets not have any [login], anyone can just make account and start chatting with friends using their userid only"*

### 4.1 The design

**Signing up is one screen with one field: a display name.** No password, no email, no phone, no gender, no confirm-password. Tap "Start chatting."

The server creates a user with two identifiers that do very different jobs:

| | **Talk ID** | **Device key** |
|---|---|---|
| Looks like | `TLK-7K4M-92XQ` | 32 random bytes, shown as a 12-word recovery phrase |
| Purpose | The thing you give friends | The thing that proves you're you |
| Visibility | Public — printed on your profile, shareable as a QR code | Secret — shown once at signup, stored in localStorage |
| Stored server-side as | Plaintext, indexed, unique | Argon2 hash only |

Friends add you by typing or scanning your **Talk ID**. That sends a chat request, exactly as today. Your **device key** never leaves your device except to exchange for a session cookie.

Format note: Talk IDs use Crockford base32 (no `I`, `O`, `1`, `0`) so they can be read aloud over a phone call without ambiguity. 10 characters gives ~50 bits — far too large to enumerate, while staying short enough to type.

### 4.2 Why not make the Talk ID itself the credential

Because you're going to hand your Talk ID to every friend you chat with, print it in your bio, and paste it in group chats. If the ID alone logged you in, **anyone who has ever seen your ID could log in as you** — and the whole point of the ID is that it circulates freely.

The device key resolves this: signup stays one tap (the key is generated silently, never typed), the shareable ID stays safe to share, and you still get real account security. This is roughly how Signal's account-vs-safety-number split works, minus the phone number.

### 4.3 Recovery, and the tradeoff you're accepting

No email and no phone means **there is no password reset and no support channel that can restore an account.** If a user clears their browser storage and hasn't saved their recovery phrase, that account and its message history are gone permanently. Nobody — including you with full database access — can recover it.

That's an acceptable and deliberate tradeoff for a frictionless privacy-first chat app, but it must be *stated*, not buried:

- After signup, a one-time screen shows the recovery phrase with **Copy**, **Download**, and a QR code, plus a checkbox: *"I've saved this. Without it, losing this browser means losing my account forever."* The user cannot proceed without ticking it.
- A persistent nudge in Settings until they confirm they've saved it.
- Signing in on a second device = pasting the phrase or scanning the QR. That's the "login" screen, and it's the only one.

I want to flag this clearly because it's the kind of thing that generates angry users months later if it isn't communicated up front. It's your call, and the design above is my recommendation for making it as painless as it can be.

### 4.4 Abuse considerations that get harder without login

Zero-friction signup means zero-friction spam account creation. Compensating controls:

- The **chat-request gate already in the app** is your main defence — strangers can't message you until you accept. Keep it, and make rejection also block by default.
- Rate-limit account creation per IP (e.g. 5/hour) and Talk ID lookups per session.
- A "requests from strangers" inbox, separate from the main list, so spam never touches the primary UI.
- Optional per-user setting: *"Only allow requests from people who know my Talk ID"* (i.e. remove me from substring search). Given §3.6, I'd argue substring search over usernames should be removed entirely — **exact Talk ID lookup only**. It's better for privacy and it makes §3.5 moot.

### 4.5 Migrating existing accounts

The `password` field becomes optional rather than being dropped. Two options for existing users — see §13, Decision 1.

---

## 5. Design system — minimal, dark + light

### 5.1 What changes and why

The current look is heavy: a photographic background image, `backdrop-filter: blur(20px)` on large surfaces, layered translucency, and gradient buttons. It's striking in a screenshot and tiring in a chat app you keep open all day. Blur over a busy background also costs real GPU time on mid-range Android, and it makes text contrast unpredictable — the same grey label sits over different backdrop pixels depending on scroll position, so it can't be guaranteed accessible.

v2 goes the other direction: **flat, quiet, high-contrast, content-first.** The interface should be boring so the messages aren't.

Concretely:

- Background image → **removed**
- `backdrop-filter` → kept only on the sticky chat header (one small surface, real purpose)
- Translucent layered surfaces → **opaque tokens**
- Shadows for structure → **1px borders**; shadow reserved for genuinely floating things (menus, modals, call overlay)
- Gradient buttons → flat accent fill
- Accent colour used everywhere → accent used for **own message bubbles, primary buttons, focus rings, and unread badges only**

### 5.2 Tokens

One token file, two themes, three user-facing settings: **Light / Dark / System**. System follows `prefers-color-scheme` live. The choice persists in localStorage and is applied before first paint to avoid a flash of the wrong theme.

```
                        LIGHT           DARK
canvas   (app bg)       #FFFFFF         #0A0A0B
surface  (sidebar)      #F7F7F8         #121214
raised   (bubbles/menus)#FFFFFF         #18181B
border                  #E5E5E7         #26262A
text.primary            #18181B         #FAFAFA
text.secondary          #71717A         #A1A1AA
text.tertiary           #A1A1AA         #71717A
accent                  #5B5BD6         #7C7CF0
accent.contrast         #FFFFFF         #FFFFFF
success (online)        #16A34A         #22C55E
danger                  #DC2626         #EF4444
```

The accent lifts in dark mode because `#5B5BD6` on `#0A0A0B` is a harsh, low-legibility pairing — dark surfaces need a lighter, slightly desaturated accent to hit the same perceived weight.

**Scales:** spacing on a 4px grid (4/8/12/16/24/32/48). Radius 8 (inputs, small) / 12 (bubbles, cards) / 16 (modals) / full (avatars, pills). Type 12/13/14/16/20/24 with weights 400/500/600 only.

### 5.3 Accessibility, treated as a requirement not a nice-to-have

- Every text-on-background pair in the table above meets **WCAG AA (4.5:1)**. I'll verify each combination with a contrast checker rather than eyeballing it, in both themes.
- Visible `:focus-visible` ring (2px accent, 2px offset) on every interactive element. Currently there's effectively no keyboard focus indication anywhere.
- Full keyboard path: Tab through conversations, Enter to open, `/` to focus search, Esc to close the thread on mobile.
- `prefers-reduced-motion: reduce` disables the slide/scale transitions — relevant for users with vestibular disorders, and currently unhandled.
- Touch targets stay at the 44px minimum already established on `v2-development`.
- Real `aria-live` on the message list so screen readers announce incoming messages.

### 5.4 Layout

Structurally similar to today (sidebar + thread, swapping to single-pane on mobile), tightened:

- **Sidebar:** your avatar + Talk ID with a one-tap copy button at the top, search below, then conversations. Each row: avatar, name, last-message preview, timestamp, unread dot. The last-message preview is new and is the single biggest usability gain in the redesign — right now every row just says "Online" or "Offline", which tells you nothing about what's waiting for you.
- **Thread:** sticky header (back button on mobile, avatar, name, real presence, call buttons, overflow menu) → message list → composer.
- **Composer:** attach, text field, emoji, send. Grows to 5 lines then scrolls. Enter sends, Shift+Enter newlines (on desktop; mobile keeps the send button).
- **Bubbles:** own messages accent-filled and right-aligned; theirs raised-surface and left-aligned. Tighter vertical rhythm than today, with consecutive messages from the same sender grouped under one avatar and one timestamp.
- **Empty, loading, and error states** designed rather than defaulted — including "you're offline", which currently has no representation at all.

---

## 6. Image messages (≤ 2 MB)

### 6.1 Client

`<input type="file" accept="image/jpeg,image/png,image/webp,image/gif">`, plus drag-and-drop and paste-from-clipboard.

Before uploading, the browser downscales in a canvas: **max 1600px on the long edge, re-encoded to WebP at q0.82.** A typical 4 MB phone photo lands around 200–400 KB. This means the 2 MB cap is a backstop that users almost never hit, rather than a wall they run into constantly — which is the difference between a limit that feels reasonable and one that feels broken. Files still over 2 MB after downscaling are rejected client-side with a clear message.

The UI shows a local preview with an upload progress ring, optimistic bubble, and retry on failure.

### 6.2 Server — the part that actually matters

```js
multer({ storage: memoryStorage(), limits: { fileSize: 2*1024*1024, files: 1 } })
```

Then, and this is the important bit: **do not trust the `Content-Type` header or the file extension.** Both are attacker-controlled. Sniff the actual magic bytes with `file-type` and accept only `image/jpeg|png|webp|gif`.

Then re-encode every upload through `sharp`. This does two jobs at once:

- **Strips EXIF**, which on phone photos contains **GPS coordinates**. Silently republishing the sender's home address to a stranger they just started chatting with is a serious privacy leak, and it's the default behaviour if you store uploads as-is.
- **Neutralizes polyglot files** — an image that's also a valid HTML or script payload doesn't survive a decode/re-encode round trip.

Generate two derivatives: a full-size (max 1600px) and a 400px thumbnail, plus a tiny blurhash string stored on the message for instant placeholder rendering.

Keep `express.json({ limit: '64kb' })` deliberately small — binary goes through multer's path, not JSON. Base64-in-JSON would inflate payloads ~33% and bypass the size limits above.

### 6.3 Storage and access control

**Local disk is not an option** — Render's filesystem is ephemeral, so every deploy would delete every image users have sent.

Recommendation: **Cloudinary** (free tier: 25 GB storage / 25 GB monthly bandwidth, with built-in transformation and CDN). Alternative: **GridFS** in the existing MongoDB — no new account, no new vendor, but your database becomes your CDN and Atlas storage is much more expensive per GB. See §13, Decision 2.

Either way, **images must not be served from guessable public URLs.** Access goes through `GET /api/media/:id`, which verifies the requester is a participant in the conversation the image belongs to. A private photo sent in a private chat should not be readable by anyone who happens to have the link — with Cloudinary this means authenticated/signed delivery URLs, not the default public ones.

---

## 7. Other features

Ranked by value-per-effort. Tier 1 ships with v2; Tier 2 follows; Tier 3 is future work.

### Tier 1 — ships with v2

| Feature | Notes |
|---|---|
| **Theme toggle** | Light / Dark / System (§5) |
| **Image messages** | §6 |
| **Typing indicators** | Socket event, debounced 2s. Small change, large perceived-quality gain |
| **Delivery + read receipts** | `sent` / `delivered` / `read` on each message |
| **Real presence + last seen** | Fields already exist in `user.model.js` and are completely unused |
| **Last-message preview in sidebar** | Currently missing; the biggest single UX gap today |
| **Reply to a message** | Quote block above the composer and in the bubble |
| **Emoji reactions** | Long-press / hover → quick picker |
| **Delete for me / for everyone** | "For everyone" within a 1-hour window |
| **In-conversation search** | Server-side, paginated |
| **Unread divider + jump to latest** | With an unread count pill |
| **Copy / context menu** | Long-press on mobile, right-click on desktop |
| **Designed empty / loading / error / offline states** | Including a connection-lost banner |

### Tier 2 — right after

Voice notes (`MediaRecorder` → same upload pipeline as images, with a waveform); edit message with an "edited" marker; pin / mute / archive conversations; profile editing (display name, avatar, bio); **QR code for your Talk ID** (makes adding someone in person genuinely pleasant, and pairs with the recovery-phrase QR from §4.3); **PWA + push notifications** (deps are already installed — §2.4).

⚠️ **Link previews** belong in Tier 2 but carry an SSRF risk: a server that fetches arbitrary user-supplied URLs can be pointed at `169.254.169.254` (cloud metadata), `localhost`, or internal RFC1918 addresses. If we build it, the fetcher must resolve DNS first and refuse private/loopback/link-local IP ranges, with a redirect cap and a hard timeout.

### Tier 3 — later, and honestly scoped

- **Real end-to-end encryption.** Replaces the fiction described in §3.2. WebCrypto ECDH + AES-GCM, or libsignal for the real thing. Be aware this **conflicts directly with server-side image processing (§6.2) and link previews** — the server can't strip EXIF from a photo it can't decrypt. That tradeoff needs a deliberate decision, not a surprise.
- **Group chats** — a substantial data-model change (`Conversation` grows roles, membership events, and per-member read state).
- **Group calls** — needs an SFU (mediasoup or LiveKit). Genuinely a separate project; peer-to-peer mesh falls apart past ~4 participants.
- Disappearing messages, message forwarding, chat export.

---

## 8. Voice and video calls

### 8.1 Architecture

**WebRTC peer-to-peer, with Socket.IO as the signaling channel.** Media flows directly between browsers; the server only brokers the handshake. 1:1 only — see the SFU note above.

### 8.2 Signaling protocol

| Event | Direction | Payload |
|---|---|---|
| `call:invite` | caller → server → callee | `{ callId, kind: 'audio'\|'video', sdpOffer }` |
| `call:ringing` | callee → caller | `{ callId }` |
| `call:accept` | callee → caller | `{ callId, sdpAnswer }` |
| `call:reject` | callee → caller | `{ callId, reason: 'declined'\|'busy'\|'unavailable' }` |
| `call:ice` | both, trickled | `{ callId, candidate }` |
| `call:end` | either | `{ callId, reason, durationMs }` |

**Every one of these events must be authorized server-side** — the same `assertCanMessage` guard from §3.3. Without it, call signaling becomes a fresh way to spam or harass someone who has blocked you, and re-opens §3.1 through a new door. The server also rejects invites to a callee already in an active call (`busy`) and expires unanswered invites after 45s.

### 8.3 Client

- `RTCPeerConnection` using the **perfect negotiation** pattern (polite/impolite peer roles) so simultaneous calls in both directions don't deadlock.
- Full-screen overlay: remote video primary, local as draggable picture-in-picture, controls for mute / camera / speaker / hang-up, elapsed timer, and a connection-quality indicator derived from `getStats()`.
- Ringtone + a browser Notification when the tab is backgrounded.
- Failure paths handled explicitly: `getUserMedia` denied → instructions to repair the permission; no camera present → fall back to audio-only; ICE failure → "Couldn't connect" with a retry, not an infinite spinner.
- Every call writes a system message into the thread — *"Video call · 4:12"*, *"Missed call"* — so history stays useful.

### 8.4 The TURN problem — please read this before committing to calls

STUN alone fails for roughly **10–20% of real-world connections**: symmetric NAT, carrier-grade NAT (very common on mobile data), and corporate firewalls all block direct peer-to-peer. Those calls need a **TURN relay**, which forwards the media stream through a server.

Google's public STUN servers are free. **TURN is not**, because it costs real bandwidth — every relayed minute of video is megabytes through someone's server.

Options:

1. **Managed TURN** — Metered, Twilio, or Cloudflare Calls. Free tiers exist (Metered's is ~50 GB/month, adequate for early testing). Simplest path.
2. **Self-hosted coturn** — a small VPS (~$5/month) running coturn. Cheaper at scale, more to operate.
3. **STUN only** — free, and roughly one call in six silently fails to connect with no obvious cause.

I'd start with a managed free tier and revisit if usage grows. What I'd avoid is option 3 without telling users, because "calls randomly don't work" reads as a broken app rather than a network limitation. See §13, Decision 3.

Also worth knowing: **iOS Safari requires HTTPS for `getUserMedia`** (fine on Render, breaks local testing over plain HTTP on a phone — use a tunnel), and background tabs on iOS suspend WebRTC aggressively.

---

## 9. Data model changes

```
User
  - talkId          String, unique, indexed        NEW  (public, shareable)
  - displayName     String                         RENAMED from fullName
  - deviceKeyHash   String                         NEW  (argon2)
  - password        String, optional               was required — see §13.1
  - gender          REMOVED
  - avatarUrl, bio, lastSeen, isOnline             kept
  - privacySettings                                kept, now actually enforced
  - themePreference 'light'|'dark'|'system'        NEW

Message
  - conversationId  ObjectId, indexed              NEW  (replaces Conversation.messages)
  - senderId        indexed
  - type            'text'|'image'|'voice'|'system'|'call'   NEW
  - body            String                         RENAMED from ciphertext (see §3.2)
  - media           { url, thumbUrl, blurhash, width, height, bytes, mime }   NEW
  - replyTo         ObjectId → Message             NEW
  - reactions       [{ userId, emoji }]            NEW
  - status          'sent'|'delivered'|'read'      NEW
  - editedAt, deletedAt                            NEW
  - iv, senderPublicKey                            REMOVED (unused, misleading)

Conversation
  - messages[]      REMOVED (unbounded growth, §3.10)
  - lastMessage     { body, senderId, at, type }   NEW (denormalized for sidebar)
  - participants    indexed
  - mutedBy[], pinnedBy[], archivedBy[]            NEW

Call                                               NEW COLLECTION
  - callId, participants[], kind, status, startedAt, endedAt, durationMs
```

**Indexes to add:** `Message { conversationId, createdAt }`, `Conversation { participants }`, `ChatRequest { receiverId, status }`, `ChatRequest { senderId, receiverId }` unique, `BlockList { userId, blockedUserId }` unique, `User { talkId }` unique.

A migration script handles: generating `talkId` + `deviceKeyHash` for existing users, `fullName` → `displayName`, `ciphertext` → `body` with `type: 'text'`, backfilling `Message.conversationId` from the `Conversation.messages` arrays before dropping them, and populating `lastMessage`. It runs idempotently and is tested against a database copy before touching production.

---

## 10. API surface

```
POST   /api/auth/register        { displayName }  → { user, recoveryPhrase }   one time only
POST   /api/auth/session         { deviceKey }    → sets cookie, returns user
GET    /api/auth/me                               → current user, or 401
POST   /api/auth/logout

GET    /api/users/by-talk-id/:talkId              exact lookup, replaces substring search (§4.4)
PATCH  /api/users/me                              displayName, bio, avatar, privacy, theme

GET    /api/conversations                         with lastMessage + unread counts
GET    /api/conversations/:id/messages?cursor=&limit=50        paginated (§3.10)
POST   /api/messages/:conversationId              text or media reference
PATCH  /api/messages/:id                          edit
DELETE /api/messages/:id?scope=me|everyone
POST   /api/messages/:id/reactions

POST   /api/uploads/image                         multipart, ≤2MB (§6)
GET    /api/media/:id                             participant-authorized (§6.3)

GET    /api/calls                                 call history
       ...chat-requests and block routes unchanged in shape
```

Everything under `/api` gets: `helmet`, rate limiting, `express.json({ limit: '64kb' })`, zod request validation, and a JSON 404 handler registered **before** the SPA catch-all (§2.9).

---

## 11. Socket protocol

Authenticated via the session cookie in `io.use()` middleware — **never the handshake query** (§3.1).

```
message:new / message:updated / message:deleted / message:reaction
typing:start / typing:stop
presence:update
conversation:read
call:invite / ringing / accept / reject / ice / end     (§8.2)
```

Presence tracked as `Map<userId, Set<socketId>>` so multiple tabs and devices work (§2.1).

---

## 12. Implementation plan

**Phase 0 — Security & correctness — ✅ COMPLETE (2026-08-17)**

| Item | § | Status |
|---|---|---|
| Socket.IO authentication from the JWT cookie | 3.1 | ✅ verified — impersonation attempts rejected |
| Remove the false "Secure Messaging" claim; `ciphertext` → `body` | 3.2 | ✅ + migration script |
| Blocking actually blocks (send, read, contact list) | 3.3 | ✅ verified |
| Rate limiting on auth / search / messages | 3.4 | ✅ |
| Regex escaping + anchoring in search | 3.5 | ✅ verified |
| Search field projection allowlist | 3.6 | ✅ verified |
| helmet + CSP | 3.7 | ✅ |
| Multi-tab presence | 2.1 | ✅ verified |
| Same-origin sockets (production real-time) | 2.2 | ✅ |
| Delete dead Tailwind CSS | 2.3 | ✅ |
| Message list append race | 2.5 | ✅ partial — see note |
| Socket listener re-subscribe + `off` scope | 2.6 | ✅ |
| Unhandled autoplay rejection | 2.7 | ✅ |
| `lastMessageRef` on every message | 2.8 | ✅ |
| JSON 404 for unmatched `/api` routes | 2.9 | ✅ |
| Header presence hardcoded to "Online" | 2.10 | ✅ |
| N+1 in `getAcceptedContacts` | 2.11 | ✅ |
| ObjectId validation, self-block, duplicate blocks, indexes | 2.12 | ✅ |
| Duplicate `height`/`minHeight` sx keys | 2.12 | ✅ |
| False PWA claim in README | 2.4 | ✅ removed |

**Note on §2.5:** appends are now race-free via a functional Zustand update with de-duplication. The deeper fix — collapsing React Query and Zustand into one source of truth for messages — is deliberately left to Phase 3, where the message model changes anyway.

**Deploy checklist for Phase 0:**
1. `node backend/scripts/check-index-preflight.js` — confirms the new unique indexes will build (run on 2026-08-17: clean).
2. Back up the database.
3. `node backend/scripts/migrate-message-body.js --dry-run`, then without the flag. Not urgent — the model falls back to reading `ciphertext`, so old messages render either way.
4. Set `CLIENT_ORIGINS` only if the frontend is ever served from a different origin.

**Phase 1 — Identity (§4)**
New schema fields, migration script, register/session/me endpoints, recovery phrase UI, remove password screens. Existing users migrate per Decision 1.

**Phase 2 — Design system (§5)**
Token file, light + dark themes, theme toggle with pre-paint application, rewrite `index.css`, restyle every component, contrast audit, keyboard/focus/reduced-motion pass.

**Phase 3 — Messaging depth (Tier 1, §7)**
Message model migration, pagination, typing indicators, receipts, reactions, replies, delete, last-message previews, real presence.

**Phase 4 — Images (§6)**
Upload pipeline, sharp processing, storage integration, authorized media route, gallery/lightbox viewer.

**Phase 5 — Calls (§8)**
Signaling with authorization, WebRTC client, call UI, TURN setup, call history.

**Phase 6 — Polish**
PWA, push notifications, QR codes, voice notes, remaining Tier 2.

Phases 0–2 are the load-bearing ones. 3–6 can be resequenced freely; if you want calls sooner, Phase 5 can move ahead of 3 and 4 once Phase 0 lands.

---

## 13. Decisions — settled 2026-08-17

**1. Existing accounts → Migrate.** `password` becomes optional. Existing users get a Talk ID, device key, and recovery phrase on their next login; password auth is then retired. No account or message history is lost.

**2. Image storage → Behind an interface.** A small storage adapter (`putObject` / `getObject` / `deleteObject`) with a **GridFS implementation first**, so moving to Cloudinary later is a one-file change and no calling code moves. Chosen to avoid committing to a vendor before the feature is proven.

**3. TURN → STUN only, for now.** Free and zero setup, accepting that roughly 1 call in 6 will fail to connect on symmetric-NAT networks (mobile data, corporate firewalls). **This must be surfaced honestly in the call UI** — an ICE failure gets a "Couldn't connect — this can happen on some mobile and office networks" message with a retry, never an infinite spinner that reads as a broken app. The signaling layer is built TURN-ready, so adding an ICE server later is a config change, not a rewrite.

**4. Scope → Phase 0 first, then reassess.** Ship the security fixes on their own before starting the redesign. Every item in Phase 0 is a live problem in the currently-deployed app, and the phase is independently deployable.

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Migration corrupts existing messages | Idempotent script, dry-run against a DB copy, full backup before running, verified counts after |
| No account recovery generates angry users | Prominent recovery-phrase flow with forced acknowledgement (§4.3) |
| Calls fail on restrictive networks | TURN (§8.4); if STUN-only, say so in the UI |
| Zero-friction signup invites spam | Chat-request gate, IP rate limits, exact-ID lookup only (§4.4) |
| Image uploads used as a file host / malware vector | Magic-byte sniffing, sharp re-encode, size + count limits, authorized delivery (§6.2) |
| MUI 9 + light/dark doubles visual QA surface | Token-driven themes, contrast checked programmatically, both modes reviewed per component |
```

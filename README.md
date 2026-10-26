# Talkify

Talkify is a minimal real-time chat app. People find each other by username,
send a message request, and chat once it is accepted. The interface is
deliberately plain: no decoration, just the conversation. It runs on
[Render](https://talkify-etjd.onrender.com/).

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Local Setup](#local-setup)
- [Scripts](#scripts)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Database Maintenance Scripts](#database-maintenance-scripts)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Real-time messaging** over Socket.IO, synced across all of your open tabs and devices.
- **Message requests**: the first message to someone is a request. Nothing more can be sent either way until they accept. They can also decline or block.
- **Blocking** works in both directions and is never announced to the blocked person.
- **Presence** (online/offline) is shared only with accepted contacts.
- **Voice & video calls**: 1:1 calls straight between browsers (WebRTC), with camera switching, mute, recovery from network drops, rejoin after a reload, and call history in the chat.
- **Image messages**: pick, paste or drag in JPEG/PNG/WebP/GIF up to 2 MB. Images are resized in the browser, re-encoded on the server (stripping location data), and visible only to the two people in the chat.
- **Voice messages** with a waveform player.
- **Installable app & push notifications** for messages and missed calls.
- **Profiles**: name, bio and photo, plus a QR code / link that opens a chat with you.
- **Chat tools**: edit a message for 15 minutes, link previews, and pin, mute or archive conversations.
- **Minimal interface**: a plain, text-first UI with flat surfaces and system fonts. Consecutive messages from the same sender are grouped into one block.
- **Light & dark themes**: follows the operating system by default, with a toggle that persists the choice.
- **Responsive UI**: one pane at a time on narrow screens, with safe-area insets for notched phones and touch-friendly targets.

## Tech Stack

- **Frontend**: [React](https://react.dev/), [Vite](https://vitejs.dev/), [TanStack Query](https://tanstack.com/query), [Zustand](https://zustand-demo.pmnd.rs/), plain CSS (no UI framework)
- **Backend**: [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), [Socket.IO](https://socket.io/)
- **Database**: [MongoDB](https://www.mongodb.com/) via Mongoose
- **Hosting**: [Render](https://render.com/)

## Local Setup

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) 22 or newer
- MongoDB running locally, or a [MongoDB Atlas](https://www.mongodb.com/atlas) connection string

### Steps

1. **Clone and install**
    ```bash
    git clone https://github.com/Abhay1006/talkify.git
    cd talkify
    npm install
    npm install --prefix frontend
    ```

2. **Configure the environment**
    ```bash
    cp .env.example .env
    ```
    Then set at least `MONGO_DB_URI` and `JWT_SECRET` (see [Environment Variables](#environment-variables)).

3. **Run in development**
    ```bash
    npm run dev
    ```
    This starts the API on `http://localhost:5001` and the Vite dev server on
    **`http://localhost:3000`**. Open port 3000; it proxies `/api` and
    `/socket.io` to the API, so the session cookie works with no CORS setup.

4. **Run a production build locally** (optional)
    ```bash
    npm run build    # installs dependencies and builds frontend/dist
    npm start        # serves the API and the built app on http://localhost:5001
    ```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (with nodemon) and Vite dev server together |
| `npm start` | Production server; serves `frontend/dist` |
| `npm run build` | Installs all dependencies and builds the frontend |
| `npm run lint` | ESLint for backend and frontend |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Backend tests. Integration tests run only when `MONGO_TEST_URI` is set |

CI (`.github/workflows/ci.yml`) runs lint, format check, the full test suite
against a MongoDB service container, and the frontend build on every PR and on
every push to `master` and `v2-development`.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGO_DB_URI` | yes | MongoDB connection string. The server exits at startup if it cannot connect. |
| `JWT_SECRET` | yes | Long random string used to sign session tokens. The server refuses to start without it. |
| `PORT` | no | API port, default `5001`. |
| `NODE_ENV` | no | `development` locally. Only controls the extra Socket.IO origin for the Vite dev server. |
| `CLIENT_ORIGINS` | no | Extra comma-separated origins allowed to open a Socket.IO connection. |
| `MONGO_TEST_URI` | no | MongoDB server for integration tests. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | no | Turn on push notifications. Generate once with `npx web-push generate-vapid-keys` and keep them stable: changing them breaks existing subscriptions. `VAPID_SUBJECT` is a `mailto:` or `https:` contact. |
| `ICE_SERVERS` | no | JSON array of WebRTC ICE servers for calls, e.g. to add a TURN relay. Defaults to Google's public STUN servers, which can't connect roughly 1 call in 6 on mobile data or office networks. |

The session cookie's `Secure` flag follows the actual request: it is set over
HTTPS (Render) and left off over plain-HTTP localhost. This needs no
configuration.

## Deployment

The app is deployed on Render as a single web service:

- **Build command**: `npm run build`
- **Start command**: `npm start`
- **Environment**: set `MONGO_DB_URI` and `JWT_SECRET` in the Render dashboard, plus the optional push and `ICE_SERVERS` settings above.

Calls and installing the app need HTTPS, which Render provides. Images and voice
messages are stored in MongoDB (GridFS), behind a small storage adapter
(`backend/storage/mediaStorage.js`) so they can move to Cloudinary or S3 later.

### Self-hosted tablet (`v2-development`)

`v2-development` is also self-hosted on a tablet and deploys itself: push to
`v2-development`, CI checks it and moves the `v2-deploy` branch to that commit,
and `scripts/tab-deploy.sh watch` on the tablet pulls, builds and restarts the
app (rolling back if it fails to start). Setup and commands:
[docs/TAB-DEPLOY.md](docs/TAB-DEPLOY.md).

## Database Maintenance Scripts

Run these against production (after a backup) when the release notes call for them:

| Script | Purpose |
|---|---|
| `node backend/scripts/check-index-preflight.js [--fix]` | Finds duplicate rows that would block the unique indexes on chat requests and blocks |
| `node backend/scripts/backfill-participants-key.js [--apply]` | Adds `participantsKey` to older conversations and removes duplicate conversations for the same pair. The app also does this lazily as pairs message each other. |
| `node backend/scripts/migrate-message-body.js` | Renames the legacy `ciphertext` message field to `body` |
| `node backend/scripts/fix-avatars.js` | Replaces avatars from the retired iran.liara.run service |

## Contributing

Suggestions and fixes are welcome: open an issue or a pull request. Please run
`npm run lint`, `npm run format` and `npm test` first.

## License

ISC

## App usage

https://github.com/user-attachments/assets/2442fc8a-6647-4cab-b3e5-15b07d6c0b99

# Talkify

Talkify is a real-time chat app. People find each other by username, send a
message request, and chat once it is accepted. It runs on
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
- **Responsive UI** with safe-area insets for notched phones and touch-friendly targets.

## Tech Stack

- **Frontend**: [React](https://react.dev/), [Vite](https://vitejs.dev/), [Material UI](https://mui.com/), [TanStack Query](https://tanstack.com/query), [Zustand](https://zustand-demo.pmnd.rs/)
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
against a MongoDB service container, and the frontend build on every PR.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGO_DB_URI` | yes | MongoDB connection string. The server exits at startup if it cannot connect. |
| `JWT_SECRET` | yes | Long random string used to sign session tokens. The server refuses to start without it. |
| `PORT` | no | API port, default `5001`. |
| `NODE_ENV` | no | `development` locally. Only controls the extra Socket.IO origin for the Vite dev server. |
| `CLIENT_ORIGINS` | no | Extra comma-separated origins allowed to open a Socket.IO connection. |
| `MONGO_TEST_URI` | no | MongoDB server for integration tests. |

The session cookie's `Secure` flag follows the actual request: it is set over
HTTPS (Render) and left off over plain-HTTP localhost. This needs no
configuration.

## Deployment

The app is deployed on Render as a single web service:

- **Build command**: `npm run build`
- **Start command**: `npm start`
- **Environment**: set `MONGO_DB_URI` and `JWT_SECRET` in the Render dashboard.

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

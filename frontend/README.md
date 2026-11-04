# Talkify frontend

React 18 + Vite + MUI. See the [root README](../README.md) for setup.

```bash
pnpm run dev     # dev server on http://localhost:3000, proxies /api and /socket.io to :5001
pnpm run build   # production build into dist/, served by the Express server
pnpm run lint
```

Server state lives in React Query (`src/queries/`). Socket events
(`src/hooks/useListenMessages.js`) write into that cache directly. The only
client state kept in zustand is the open conversation and unread counts.

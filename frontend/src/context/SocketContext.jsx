import { createContext, useState, useEffect, useContext } from "react";
import io from "socket.io-client";
import { useAuthContext } from "./AuthContext";
import { apiClient } from "../api/client";

const SocketContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useSocketContext = () => {
  return useContext(SocketContext);
};

const EMPTY = new Set();
const RETRY_DELAY_MS = 3000;

export const SocketContextProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(EMPTY);
  // "connecting" | "connected" | "disconnected"
  const [status, setStatus] = useState("disconnected");
  const { authUser } = useAuthContext();
  // Keyed on the id, not the object: refreshing the profile from /me must not
  // tear the socket down and reconnect.
  const userId = authUser?._id;

  useEffect(() => {
    if (!userId) return;

    // No URL: connect to the page's own origin. Vite proxies /socket.io to the
    // API in development, and in production both are the same server. Identity
    // comes from the jwt cookie.
    const newSocket = io({ withCredentials: true });
    setSocket(newSocket);
    setStatus("connecting");

    // The server rejected or ended the session (logout in this browser, token
    // expiry, deleted account). Ask the API: a 401 there logs this tab out
    // through the client's unauthorized handler; otherwise try again.
    let closed = false;
    let retryTimer;
    const recheckSession = () => {
      apiClient
        .get("/api/auth/me")
        .then(() => {
          if (closed) return;
          clearTimeout(retryTimer);
          retryTimer = setTimeout(() => !closed && newSocket.connect(), RETRY_DELAY_MS);
        })
        .catch(() => {});
    };

    newSocket.on("connect", () => setStatus("connected"));
    newSocket.on("disconnect", (reason) => {
      setStatus(reason === "io client disconnect" ? "disconnected" : "connecting");
      setOnlineUsers(EMPTY);
      if (reason === "io server disconnect") recheckSession();
    });
    newSocket.on("connect_error", (err) => {
      console.warn("socket connection failed:", err.message);
      // Middleware rejections are not retried automatically; transport
      // failures are.
      if (!newSocket.active) {
        setStatus("disconnected");
        recheckSession();
      }
    });

    // Presence is limited to accepted contacts. The full list arrives on
    // connect (and on request); after that only changes are sent.
    newSocket.on("onlineUsers", (ids) => setOnlineUsers(new Set(ids)));
    newSocket.on("userOnline", (id) => setOnlineUsers((prev) => new Set(prev).add(id)));
    newSocket.on("userOffline", (id) =>
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      })
    );

    return () => {
      closed = true;
      clearTimeout(retryTimer);
      newSocket.close();
      setSocket(null);
      setOnlineUsers(EMPTY);
      setStatus("disconnected");
    };
  }, [userId]);

  return <SocketContext.Provider value={{ socket, onlineUsers, status }}>{children}</SocketContext.Provider>;
};

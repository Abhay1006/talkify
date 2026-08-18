import { createContext, useState, useEffect, useContext } from "react";
import { useAuthContext } from "./AuthContext";
import io from "socket.io-client";

const SocketContext = createContext();

export const useSocketContext = () => {
  return useContext(SocketContext);
};

// eslint-disable-next-line react/prop-types
export const SocketContextProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { authUser } = useAuthContext();

  useEffect(() => {
    if (!authUser) {
      setSocket(null);
      setOnlineUsers([]);
      return;
    }

    // No URL: connect to the page's own origin. Vite proxies /socket.io to the
    // API in development, and in production both are the same server. Identity
    // comes from the jwt cookie, so no userId is sent here — the old query
    // parameter let anyone claim to be any user.
    const newSocket = io({ withCredentials: true });

    setSocket(newSocket);

    newSocket.on("getOnlineUsers", (users) => {
      setOnlineUsers(users);
    });

    newSocket.on("connect_error", (err) => {
      console.warn("socket connection failed:", err.message);
    });

    return () => {
      newSocket.close();
      setSocket(null);
      setOnlineUsers([]);
    };
  }, [authUser]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};

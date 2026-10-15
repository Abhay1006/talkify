import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, registerUnauthorizedCallback } from "../api/client";
import useConversation from "../zustand/useConversations";

const STORAGE_KEY = "chat-user";

// localStorage can hold anything (an old format, a manual edit, a truncated
// write) and can throw outright in some private-browsing modes. A bad value
// must mean "logged out", not a blank screen.
const readStoredUser = () => {
  try {
    const user = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return user && typeof user._id === "string" ? user : null;
  } catch {
    return null;
  }
};

const writeStoredUser = (user) => {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the session still works for this tab.
  }
};

export const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuthContext = () => {
  return useContext(AuthContext);
};

export const AuthContextProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const [authUser, setAuthUser] = useState(readStoredUser);
  // The stored user is only a hint. Until the server confirms the session
  // cookie is still valid, render a loading state instead of a logged-in shell.
  const [checkingSession, setCheckingSession] = useState(() => readStoredUser() !== null);

  // Drops every trace of the current account from this tab: cached API data,
  // the selected chat, unread counts. Without this the next person to log in
  // on a shared device could briefly see the previous user's conversations.
  const resetClientState = useCallback(() => {
    useConversation.getState().reset();
    queryClient.clear();
  }, [queryClient]);

  const startSession = useCallback(
    (user) => {
      resetClientState();
      writeStoredUser(user);
      setAuthUser(user);
    },
    [resetClientState]
  );

  const endSession = useCallback(() => {
    resetClientState();
    writeStoredUser(null);
    setAuthUser(null);
  }, [resetClientState]);

  // Merges profile changes (name, bio, avatar) into the session user.
  const updateAuthUser = useCallback((patch) => {
    setAuthUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      writeStoredUser(next);
      return next;
    });
  }, []);

  useEffect(() => {
    registerUnauthorizedCallback(endSession);
    return () => registerUnauthorizedCallback(null);
  }, [endSession]);

  // Confirm the stored session once on load.
  useEffect(() => {
    if (!readStoredUser()) return;

    let cancelled = false;
    apiClient
      .get("/api/auth/me")
      .then((user) => {
        if (cancelled) return;
        writeStoredUser(user);
        setAuthUser(user);
      })
      // A 401 has already ended the session through the callback above. Any
      // other failure (offline, server down) keeps the stored user, and the
      // next request will settle it.
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Keep every open tab on the same account. A logout in one tab used to leave
  // the others showing a session whose cookie was already gone.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const user = readStoredUser();
      setAuthUser((current) => {
        // Another tab refreshing the same profile is not an account change.
        if (current?._id !== user?._id) resetClientState();
        return user;
      });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [resetClientState]);

  return (
    <AuthContext.Provider value={{ authUser, checkingSession, startSession, endSession, updateAuthUser }}>
      {children}
    </AuthContext.Provider>
  );
};

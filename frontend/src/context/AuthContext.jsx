import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { registerUnauthorizedCallback } from "../api/client";

export const AuthContext = createContext();
// eslint-disable-next-line react-refresh/only-export-components
export const useAuthContext = () => {
  return useContext(AuthContext);
};

// eslint-disable-next-line react/prop-types
export const AuthContextProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(
    JSON.parse(localStorage.getItem("chat-user")) || null
  );

  useEffect(() => {
    registerUnauthorizedCallback(() => {
      localStorage.removeItem("chat-user");
      setAuthUser(null);
    });
    return () => {
      registerUnauthorizedCallback(null);
    };
  }, []);

  // Merges profile changes into the stored user (name, avatar, bio).
  const updateAuthUser = useCallback((patch) => {
    setAuthUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      localStorage.setItem("chat-user", JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ authUser, setAuthUser, updateAuthUser }}>
      {children}
    </AuthContext.Provider>
  );
};

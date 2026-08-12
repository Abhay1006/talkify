import { createContext, useContext, useState, useEffect } from "react";
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

  return (
    <AuthContext.Provider value={{ authUser, setAuthUser }}>
      {children}
    </AuthContext.Provider>
  );
};

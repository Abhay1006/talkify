import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SnackbarProvider } from "notistack";
import theme from "./theme";
import App from "./App";
import "./index.css";
import { AuthContextProvider } from "./context/AuthContext";
import { SocketContextProvider } from "./context/SocketContext";
import { initPwa } from "./pwa";
import { captureDeepLink } from "./hooks/useDeepLinks";

captureDeepLink();
initPwa();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Retry once for network failures and server errors only. A 4xx (blocked,
      // not found, unauthorized) will not change on a second attempt.
      retry: (failureCount, error) => failureCount < 1 && (!error?.status || error.status >= 500),
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
          <BrowserRouter>
            <AuthContextProvider>
              <SocketContextProvider>
                <App />
              </SocketContextProvider>
            </AuthContextProvider>
          </BrowserRouter>
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

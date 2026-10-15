import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../context/ToastContext";
import { apiClient } from "../api/client";
import useConversation from "../zustand/useConversations";
import { conversationsQuery } from "../queries/conversations";

// Links into the app:
//   /?add=<username>   from a profile QR code or shared link: open a chat
//   /?chat=<userId>    from a notification: open that conversation
// A link opened while logged out is remembered until after login.

const STORAGE_KEY = "talkify-deeplink";

/** Call once at startup, before routing can redirect to /login. */
export const captureDeepLink = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.has("add") || params.has("chat")) {
    try {
      sessionStorage.setItem(STORAGE_KEY, window.location.search);
    } catch {
      // Private mode: the link still works if they're already logged in.
    }
  }
};

const takePendingLink = () => {
  let search = window.location.search;
  try {
    search = sessionStorage.getItem(STORAGE_KEY) ?? search;
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  return new URLSearchParams(search);
};

const useDeepLinks = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const setSelectedConversation = useConversation((s) => s.setSelectedConversation);

  useEffect(() => {
    const open = async (params) => {
      const chatId = params.get("chat");
      const username = params.get("add");
      try {
        if (chatId) {
          const contacts = await queryClient.fetchQuery(conversationsQuery);
          const contact = contacts.find((c) => c._id === chatId);
          if (contact) setSelectedConversation(contact);
        } else if (username) {
          if (username.length < 3 || username.length > 64) throw new Error("bad");
          const results = await apiClient.get(`/api/users/search?q=${encodeURIComponent(username)}`);
          const match = results.find((u) => u.username.toLowerCase() === username.toLowerCase());
          if (match) setSelectedConversation(match);
          else toast(`Couldn’t find @${username}`, "warning");
        }
      } catch {
        if (username) toast(`Couldn’t open a chat with @${username}`, "warning");
      }
    };

    open(takePendingLink());

    // Notification clicked while Talkify was already open.
    const onMessage = (event) => {
      if (event.data?.type === "OPEN_URL") {
        open(new URL(event.data.url, window.location.origin).searchParams);
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, [queryClient, toast, setSelectedConversation]);
};

export default useDeepLinks;

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useSocketContext } from "../context/SocketContext";
import { useAuthContext } from "../context/AuthContext";
import useConversation from "../zustand/useConversations";
import { conversationsQueryKey } from "../queries/conversations";
import { appendMessageToCache } from "../queries/messages";

import notificationSound from "../assets/sounds/notification.mp3";

const sound = new Audio(notificationSound);

/**
 * Real-time updates for the whole signed-in UI. Mounted once in Home — not in
 * the message pane, where it only ran while a chat was open, so unread badges
 * and the notification sound never fired from the conversation list.
 */
const useListenMessages = () => {
  const { socket } = useSocketContext();
  const { authUser } = useAuthContext();
  const queryClient = useQueryClient();
  const myId = authUser?._id;

  useEffect(() => {
    if (!socket || !myId) return;

    const handleNewMessage = (newMessage) => {
      const fromMe = newMessage.senderId === myId;
      const otherId = fromMe ? newMessage.receiverId : newMessage.senderId;

      appendMessageToCache(queryClient, otherId, newMessage);
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey });

      // Our own message echoed from another tab or device.
      if (fromMe) return;

      // Autoplay is blocked until the user has interacted with the page.
      sound.currentTime = 0;
      sound.play().catch(() => {});

      // Read at event time rather than closing over it, so the handler
      // never needs re-registering.
      const { selectedConversation, addUnreadMessage } = useConversation.getState();
      if (selectedConversation?._id !== otherId) addUnreadMessage(otherId);
    };

    // A request was sent to us, or one we sent was accepted.
    const handleContactsUpdated = () => {
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
      socket.emit("getOnlineUsers");
    };

    // Anything sent while this tab had no live socket was missed: during a
    // disconnect, and also in the gap between the first fetch and the first
    // connect. Refresh on every connect, the first one included.
    const handleConnect = () => {
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("contactsUpdated", handleContactsUpdated);
    socket.on("connect", handleConnect);

    // Pass the handlers so this removes only its own listeners.
    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("contactsUpdated", handleContactsUpdated);
      socket.off("connect", handleConnect);
    };
  }, [socket, myId, queryClient]);
};

export default useListenMessages;

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useSocketContext } from "../context/SocketContext";
import { useAuthContext } from "../context/AuthContext";
import useConversation from "../zustand/useConversations";

import notificationSound from "../assets/sounds/notification.mp3";

const sound = new Audio(notificationSound);

const useListenMessages = () => {
	const { socket } = useSocketContext();
	const { authUser } = useAuthContext();
	const { appendMessage, addUnreadMessage } = useConversation();
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!socket) return;

		const handleNewMessage = (newMessage) => {
			const fromMe = newMessage.senderId === authUser?._id;
			// Call-history lines are pushed to both people, so this may be our own.
			const partnerId = fromMe ? newMessage.receiverId : newMessage.senderId;

			// Calls have their own ringtone; don't add a message chime on top.
			if (!newMessage.call) {
				// Autoplay is blocked until the user has interacted with the page, and
				// the resulting rejection was previously unhandled.
				sound.currentTime = 0;
				sound.play().catch(() => {});
			}

			// Read the selected conversation at event time rather than closing over
			// it, so the handler never needs re-registering.
			const { selectedConversation } = useConversation.getState();

			if (selectedConversation?._id === partnerId) {
				appendMessage(newMessage);
			} else if (!fromMe) {
				addUnreadMessage(partnerId);
			}

			queryClient.invalidateQueries({ queryKey: ["conversations"] });
		};

		socket.on("newMessage", handleNewMessage);

		// Pass the handler so this removes only its own listener. The bare
		// socket.off("newMessage") it replaced would have torn down every other
		// feature's listener too.
		return () => socket.off("newMessage", handleNewMessage);
	}, [socket, authUser?._id, appendMessage, addUnreadMessage, queryClient]);
};

export default useListenMessages;

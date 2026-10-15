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
	const { appendMessage, addUnreadMessage, updateMessage } = useConversation();
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!socket) return;

		const handleNewMessage = (newMessage) => {
			const fromMe = newMessage.senderId === authUser?._id;
			// Call-history lines are pushed to both people, so this may be our own.
			const partnerId = fromMe ? newMessage.receiverId : newMessage.senderId;

			// Calls have their own ringtone, and muted chats stay quiet.
			const contact = queryClient.getQueryData(["conversations"])?.find?.((c) => c._id === partnerId);
			if (!newMessage.call && !fromMe && !contact?.muted) {
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

		const handleMessageUpdated = (message) => {
			const me = authUser?._id;
			const partnerId = message.senderId === me ? message.receiverId : message.senderId;
			const { messages, selectedConversation } = useConversation.getState();
			// A link preview can arrive before the sender's own POST response has
			// added the message. Add the newer copy now; the late original is then
			// dropped as a duplicate.
			if (!messages.some((m) => m._id === message._id) && selectedConversation?._id === partnerId) {
				appendMessage(message);
			} else {
				updateMessage(message);
			}
			// Keep the cached copy in step, so reopening the chat shows the edit.
			queryClient.setQueryData(["messages", partnerId], (old) =>
				Array.isArray(old) ? old.map((m) => (m._id === message._id ? message : m)) : old
			);
		};

		socket.on("newMessage", handleNewMessage);
		socket.on("messageUpdated", handleMessageUpdated);

		// Pass the handler so this removes only its own listener. The bare
		// socket.off("newMessage") it replaced would have torn down every other
		// feature's listener too.
		return () => {
			socket.off("newMessage", handleNewMessage);
			socket.off("messageUpdated", handleMessageUpdated);
		};
	}, [socket, authUser?._id, appendMessage, addUnreadMessage, updateMessage, queryClient]);
};

export default useListenMessages;

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useSocketContext } from "../context/SocketContext";
import useConversation from "../zustand/useConversations";

import notificationSound from "../assets/sounds/notification.mp3";

const useListenMessages = () => {
	const { socket } = useSocketContext();
	const { messages, setMessages, selectedConversation, addUnreadMessage } = useConversation();
	const queryClient = useQueryClient();

	useEffect(() => {
		socket?.on("newMessage", (newMessage) => {
			newMessage.shouldShake = true;
			const sound = new Audio(notificationSound);
			sound.play();

			if (selectedConversation?._id === newMessage.senderId) {
				setMessages([...messages, newMessage]);
			} else {
				addUnreadMessage(newMessage.senderId);
			}

			queryClient.invalidateQueries({ queryKey: ['conversations'] });
		});

		return () => socket?.off("newMessage");
	}, [socket, setMessages, messages, queryClient, selectedConversation, addUnreadMessage]);
};
export default useListenMessages;
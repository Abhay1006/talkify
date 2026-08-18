import { create } from "zustand";

const useConversation = create((set) => ({
  selectedConversation: null,
  setSelectedConversation: (selectedConversation) =>
    set((state) => {
      if (selectedConversation) {
        const newUnread = { ...state.unreadMessages };
        delete newUnread[selectedConversation._id];
        return { selectedConversation, unreadMessages: newUnread };
      }
      return { selectedConversation };
    }),

  messages: [],
  setMessages: (messages) => set({ messages }),

  // Functional update so an append never reads a stale `messages` array from a
  // closure. Two messages arriving in the same tick used to drop one.
  appendMessage: (message) =>
    set((state) =>
      state.messages.some((m) => m._id === message._id)
        ? state
        : { messages: [...state.messages, message] }
    ),

  unreadMessages: {},
  addUnreadMessage: (userId) =>
    set((state) => ({
      unreadMessages: {
        ...state.unreadMessages,
        [userId]: (state.unreadMessages[userId] || 0) + 1,
      },
    })),
}));

export default useConversation;

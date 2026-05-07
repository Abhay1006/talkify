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
  unreadMessages: {},
  addUnreadMessage: (userId) => set((state) => ({
    unreadMessages: {
      ...state.unreadMessages,
      [userId]: (state.unreadMessages[userId] || 0) + 1
    }
  }))
}));

export default useConversation;

import { create } from "zustand";

const initialState = {
  // A snapshot of the user picked from the sidebar or from search. Components
  // read it through useSelectedConversation(), which overlays the latest data
  // from the contact list so request status never goes stale.
  selectedConversation: null,
  unreadMessages: {},
};

// Messages are not kept here. React Query's cache is their single source of
// truth; socket events write into that cache directly.
const useConversation = create((set) => ({
  ...initialState,

  setSelectedConversation: (selectedConversation) =>
    set((state) => {
      if (!selectedConversation) return { selectedConversation: null };
      const unreadMessages = { ...state.unreadMessages };
      delete unreadMessages[selectedConversation._id];
      return { selectedConversation, unreadMessages };
    }),

  addUnreadMessage: (userId) =>
    set((state) => ({
      unreadMessages: {
        ...state.unreadMessages,
        [userId]: (state.unreadMessages[userId] || 0) + 1,
      },
    })),

  // Called on every login and logout so nothing from one account survives into
  // the next on a shared device.
  reset: () => set(initialState),
}));

export default useConversation;

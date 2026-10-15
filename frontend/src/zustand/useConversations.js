import { create } from "zustand";

const initialState = {
  // A snapshot of the user picked from the sidebar or from search. Components
  // read it through useSelectedConversation(), which overlays the latest data
  // from the contact list so request status never goes stale.
  selectedConversation: null,
  unreadMessages: {},
  // The image waiting in the composer, before Send. Lives here rather than in
  // MessageInput so drag-and-drop onto the whole chat can fill it too.
  // { status: 'preparing' } | { status: 'ready', blob, previewUrl, width, height }
  imageDraft: null,
  // Image messages still uploading (or failed), shown as optimistic bubbles.
  // { tempId, receiverId, blob, previewUrl, width, height, caption,
  //   progress, status: 'uploading' | 'failed', error }
  pendingImages: [],
  // The message being edited in the composer, if any.
  editingMessage: null,
};

const revoke = (url) => url && URL.revokeObjectURL(url);

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

  setImageDraft: (imageDraft) =>
    set((state) => {
      const old = state.imageDraft?.previewUrl;
      if (old !== imageDraft?.previewUrl) revoke(old);
      return { imageDraft };
    }),
  // Hands the draft over to an upload without revoking its preview URL.
  takeImageDraft: () => {
    let draft = null;
    set((state) => {
      draft = state.imageDraft;
      return { imageDraft: null };
    });
    return draft;
  },

  addPendingImage: (pending) => set((state) => ({ pendingImages: [...state.pendingImages, pending] })),
  updatePendingImage: (tempId, patch) =>
    set((state) => ({
      pendingImages: state.pendingImages.map((p) => (p.tempId === tempId ? { ...p, ...patch } : p)),
    })),
  removePendingImage: (tempId) =>
    set((state) => {
      revoke(state.pendingImages.find((p) => p.tempId === tempId)?.previewUrl);
      return { pendingImages: state.pendingImages.filter((p) => p.tempId !== tempId) };
    }),

  setEditingMessage: (editingMessage) => set({ editingMessage }),

  // Called on every login and logout so nothing from one account survives into
  // the next on a shared device.
  reset: () =>
    set((state) => {
      revoke(state.imageDraft?.previewUrl);
      state.pendingImages.forEach((p) => revoke(p.previewUrl));
      return initialState;
    }),
}));

export default useConversation;

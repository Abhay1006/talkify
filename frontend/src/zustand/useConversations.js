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

  // An edit, or a link preview arriving after the fact.
  updateMessage: (message) =>
    set((state) => ({
      messages: state.messages.map((m) => (m._id === message._id ? message : m)),
    })),

  // The message being edited in the composer, if any.
  editingMessage: null,
  setEditingMessage: (editingMessage) => set({ editingMessage }),

  unreadMessages: {},
  addUnreadMessage: (userId) =>
    set((state) => ({
      unreadMessages: {
        ...state.unreadMessages,
        [userId]: (state.unreadMessages[userId] || 0) + 1,
      },
    })),

  // The image waiting in the composer, before Send. Lives here rather than in
  // MessageInput so drag-and-drop onto the whole chat can fill it too.
  // { status: 'preparing' } | { status: 'ready', blob, previewUrl, width, height }
  imageDraft: null,
  setImageDraft: (imageDraft) =>
    set((state) => {
      const old = state.imageDraft?.previewUrl;
      if (old && old !== imageDraft?.previewUrl) URL.revokeObjectURL(old);
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

  // Image messages still uploading (or failed), shown as optimistic bubbles.
  // { tempId, receiverId, blob, previewUrl, width, height, caption,
  //   progress, status: 'uploading' | 'failed', error }
  pendingImages: [],
  addPendingImage: (pending) =>
    set((state) => ({ pendingImages: [...state.pendingImages, pending] })),
  updatePendingImage: (tempId, patch) =>
    set((state) => ({
      pendingImages: state.pendingImages.map((p) => (p.tempId === tempId ? { ...p, ...patch } : p)),
    })),
  removePendingImage: (tempId) =>
    set((state) => {
      const pending = state.pendingImages.find((p) => p.tempId === tempId);
      if (pending) URL.revokeObjectURL(pending.previewUrl);
      return { pendingImages: state.pendingImages.filter((p) => p.tempId !== tempId) };
    }),
}));

export default useConversation;

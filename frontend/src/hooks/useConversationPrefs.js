import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../context/ToastContext";
import { apiClient } from "../api/client";
import { conversationsQueryKey } from "../queries/conversations";

// Pin / mute / archive a chat, updating the sidebar immediately and rolling
// back if the server refuses.
const useConversationPrefs = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useCallback(
    async (partnerId, patch) => {
      const previous = queryClient.getQueryData(conversationsQueryKey);
      queryClient.setQueryData(conversationsQueryKey, (list) =>
        Array.isArray(list) ? list.map((c) => (c._id === partnerId ? { ...c, ...patch } : c)) : list
      );
      try {
        await apiClient.put(`/api/users/prefs/${partnerId}`, patch);
      } catch (error) {
        queryClient.setQueryData(conversationsQueryKey, previous);
        toast(error.message, "error");
      }
    },
    [queryClient, toast]
  );
};

export default useConversationPrefs;

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { apiClient } from "../api/client";
import { conversationsQueryKey } from "../queries/conversations";
import { appendMessageToCache } from "../queries/messages";

const useSendMessage = (receiverId) => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (message) =>
      apiClient.post(`/api/messages/send/${encodeURIComponent(receiverId)}`, { message }),
    onSuccess: (data) => {
      appendMessageToCache(queryClient, receiverId, data);
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: "error" });
      // A 403 usually means the request state changed underneath us (declined,
      // blocked, not yet accepted). Refresh so the UI shows the real state.
      if (error.status === 403) queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });

  // Resolves to true when the message was sent, so the caller only clears the
  // input on success and a failed send never loses what the user typed.
  const sendMessage = async (message) => {
    try {
      await mutateAsync(message);
      return true;
    } catch {
      return false;
    }
  };

  return { sendMessage, loading: isPending };
};

export default useSendMessage;

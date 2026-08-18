import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import useConversation from '../zustand/useConversations';
import { apiClient } from '../api/client';

const useSendMessage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { appendMessage, selectedConversation } = useConversation();
  const queryClient = useQueryClient();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (message) => apiClient.post(`/api/messages/send/${selectedConversation._id}`, { message }),
    onSuccess: (data) => {
      appendMessage(data);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' });
    },
  });

  const sendMessage = async (message) => {
    try {
      await mutateAsync(message);
    } catch (error) {
      // Error handled in onError
    }
  };

  return { sendMessage, loading: isPending };
};

export default useSendMessage;

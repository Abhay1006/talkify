import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import useConversation from '../zustand/useConversations.js';
import { apiClient } from '../api/client';

const useGetMessages = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { messages, setMessages, selectedConversation } = useConversation();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['messages', selectedConversation?._id],
    queryFn: () => apiClient.get(`/api/messages/${selectedConversation._id}`),
    enabled: !!selectedConversation?._id,
  });

  useEffect(() => {
    if (data) {
      setMessages(data);
    }
  }, [data, setMessages]);

  useEffect(() => {
    if (isError && error) {
      enqueueSnackbar(error.message, { variant: 'error' });
    }
  }, [isError, error, enqueueSnackbar]);

  return { messages, loading: isLoading };
};

export default useGetMessages;

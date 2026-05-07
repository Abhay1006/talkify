import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { apiClient } from '../api/client';

const useGetConversations = () => {
  const { enqueueSnackbar } = useSnackbar();

  const { data: conversations = [], isLoading, isError, error } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiClient.get('/api/users'),
  });

  useEffect(() => {
    if (isError && error) {
      enqueueSnackbar(error.message, { variant: 'error' });
    }
  }, [isError, error, enqueueSnackbar]);

  return { loading: isLoading, conversations };
};

export default useGetConversations;

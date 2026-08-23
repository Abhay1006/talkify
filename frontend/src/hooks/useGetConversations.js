import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../api/client';

const useGetConversations = () => {
  const { toast } = useToast();

  const { data: conversations = [], isLoading, isError, error } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiClient.get('/api/users'),
  });

  useEffect(() => {
    if (isError && error) {
      toast(error.message, 'error');
    }
  }, [isError, error, toast]);

  return { loading: isLoading, conversations };
};

export default useGetConversations;

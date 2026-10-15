import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { apiClient } from '../api/client';

// Pin / mute / archive a chat, updating the sidebar immediately and rolling
// back if the server refuses.
const useConversationPrefs = () => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useCallback(async (partnerId, patch) => {
    const previous = queryClient.getQueryData(['conversations']);
    queryClient.setQueryData(['conversations'], (list) =>
      Array.isArray(list) ? list.map((c) => (c._id === partnerId ? { ...c, ...patch } : c)) : list
    );
    try {
      await apiClient.put(`/api/users/prefs/${partnerId}`, patch);
    } catch (error) {
      queryClient.setQueryData(['conversations'], previous);
      enqueueSnackbar(error.message, { variant: 'error' });
    }
  }, [queryClient, enqueueSnackbar]);
};

export default useConversationPrefs;

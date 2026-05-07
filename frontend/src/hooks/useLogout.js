import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useAuthContext } from '../context/AuthContext';
import { apiClient } from '../api/client';

const useLogout = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { setAuthUser } = useAuthContext();
  const queryClient = useQueryClient();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: () => apiClient.post('/api/auth/logout', {}),
    onSuccess: () => {
      localStorage.removeItem('chat-user');
      setAuthUser(null);
      queryClient.clear();
      enqueueSnackbar('Logged out successfully', { variant: 'info' });
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' });
    },
  });

  const logout = async () => {
    try {
      await mutateAsync();
    } catch (error) {
      // Error handled in onError
    }
  };

  return { loading: isPending, logout };
};

export default useLogout;
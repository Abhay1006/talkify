import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import { useAuthContext } from '../context/AuthContext';
import { apiClient } from '../api/client';

const useLogout = () => {
  const { toast } = useToast();
  const { setAuthUser } = useAuthContext();
  const queryClient = useQueryClient();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: () => apiClient.post('/api/auth/logout', {}),
    onSuccess: () => {
      localStorage.removeItem('chat-user');
      setAuthUser(null);
      queryClient.clear();
      toast('Logged out successfully', 'info');
    },
    onError: (error) => {
      toast(error.message, 'error');
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
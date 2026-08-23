import { useMutation } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import { useAuthContext } from '../context/AuthContext';
import { apiClient } from '../api/client';

const useLogin = () => {
  const { toast } = useToast();
  const { setAuthUser } = useAuthContext();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (credentials) => apiClient.post('/api/auth/login', credentials),
    onSuccess: (data) => {
      localStorage.setItem('chat-user', JSON.stringify(data));
      setAuthUser(data);
      toast('Logged in successfully', 'success');
    },
    onError: (error) => {
      toast(error.message, 'error');
    },
  });

  const login = async (username, password) => {
    try {
      await mutateAsync({ username, password });
    } catch (error) {
      // Error handled in onError
    }
  };

  return { loading: isPending, login };
};

export default useLogin;

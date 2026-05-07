import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useAuthContext } from '../context/AuthContext';
import { apiClient } from '../api/client';

const useLogin = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { setAuthUser } = useAuthContext();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (credentials) => apiClient.post('/api/auth/login', credentials),
    onSuccess: (data) => {
      localStorage.setItem('chat-user', JSON.stringify(data));
      setAuthUser(data);
      enqueueSnackbar('Logged in successfully', { variant: 'success' });
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' });
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

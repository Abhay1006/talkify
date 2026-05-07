import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useAuthContext } from '../context/AuthContext';
import { apiClient } from '../api/client';

const useSignup = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { setAuthUser } = useAuthContext();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (userData) => apiClient.post('/api/auth/signup', userData),
    onSuccess: (data) => {
      localStorage.setItem('chat-user', JSON.stringify(data));
      setAuthUser(data);
      enqueueSnackbar('Account created successfully', { variant: 'success' });
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' });
    },
  });

  const signup = async (userData) => {
    try {
      await mutateAsync(userData);
    } catch (error) {
      // Error handled in onError
    }
  };

  return [isPending, signup];
};

export default useSignup;

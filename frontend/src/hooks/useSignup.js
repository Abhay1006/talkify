import { useMutation } from "@tanstack/react-query";
import { useToast } from "../context/ToastContext";
import { useAuthContext } from "../context/AuthContext";
import { apiClient } from "../api/client";

const useSignup = () => {
  const { toast } = useToast();
  const { startSession } = useAuthContext();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (userData) => apiClient.post("/api/auth/signup", userData),
    onSuccess: (data) => {
      startSession(data);
      toast("Account created successfully", "success");
    },
    onError: (error) => {
      toast(error.message, "error");
    },
  });

  const signup = async (userData) => {
    try {
      await mutateAsync(userData);
    } catch {
      // Reported in onError
    }
  };

  return { loading: isPending, signup };
};

export default useSignup;

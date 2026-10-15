import { useMutation } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useAuthContext } from "../context/AuthContext";
import { apiClient } from "../api/client";
import { unsubscribeThisDevice } from "./usePushNotifications";

const useLogout = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { endSession } = useAuthContext();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      // A shared computer shouldn't keep getting this user's notifications.
      await unsubscribeThisDevice();
      return apiClient.post("/api/auth/logout", {});
    },
    // onSettled, not onSuccess: if the request fails (offline, server down) the
    // user still asked to be logged out of this device, so the local session
    // ends regardless. The cookie expires on its own.
    onSettled: (_data, error) => {
      endSession();
      enqueueSnackbar(
        error ? "Logged out on this device. The server could not be reached." : "Logged out successfully",
        { variant: error ? "warning" : "info" }
      );
    },
  });

  const logout = async () => {
    try {
      await mutateAsync();
    } catch {
      // Handled in onSettled
    }
  };

  return { loading: isPending, logout };
};

export default useLogout;

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { conversationsQuery } from "../queries/conversations";

const useGetConversations = () => {
  const { enqueueSnackbar } = useSnackbar();

  const { data: conversations = [], isLoading, isError, error, refetch } = useQuery(conversationsQuery);

  useEffect(() => {
    if (isError && error) {
      enqueueSnackbar(error.message, { variant: "error" });
    }
  }, [isError, error, enqueueSnackbar]);

  return { loading: isLoading, conversations, isError, refetch };
};

export default useGetConversations;

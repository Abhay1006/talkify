import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "../context/ToastContext";
import { conversationsQuery } from "../queries/conversations";

const useGetConversations = () => {
  const { toast } = useToast();

  const { data: conversations = [], isLoading, isError, error, refetch } = useQuery(conversationsQuery);

  useEffect(() => {
    if (isError && error) {
      toast(error.message, "error");
    }
  }, [isError, error, toast]);

  return { loading: isLoading, conversations, isError, refetch };
};

export default useGetConversations;

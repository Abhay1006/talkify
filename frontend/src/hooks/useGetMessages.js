import { useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { fetchMessagesPage, messagesQueryKey } from "../queries/messages";

const useGetMessages = (userId) => {
  const { enqueueSnackbar } = useSnackbar();

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: messagesQueryKey(userId),
      queryFn: ({ pageParam }) => fetchMessagesPage(userId, pageParam),
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      enabled: Boolean(userId),
      // Socket events keep a loaded conversation current, and the cache is
      // invalidated on reconnect, so reopening a chat needs no refetch.
      staleTime: Infinity,
    });

  useEffect(() => {
    if (isError && error) {
      enqueueSnackbar(error.message, { variant: "error" });
    }
  }, [isError, error, enqueueSnackbar]);

  // Pages run newest first; each page is oldest first internally.
  const messages = useMemo(
    () => (data ? [...data.pages].reverse().flatMap((page) => page.messages) : []),
    [data]
  );

  return {
    messages,
    loading: isLoading,
    fetchOlder: fetchNextPage,
    hasOlder: hasNextPage,
    loadingOlder: isFetchingNextPage,
  };
};

export default useGetMessages;

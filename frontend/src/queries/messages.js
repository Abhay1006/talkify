import { apiClient } from "../api/client";

export const messagesQueryKey = (userId) => ["messages", userId];

export const fetchMessagesPage = (userId, before) =>
  apiClient.get(
    `/api/messages/${encodeURIComponent(userId)}${before ? `?before=${encodeURIComponent(before)}` : ""}`
  );

/**
 * Adds a message to a cached conversation. Pages are newest first, so it goes
 * on the end of page 0. Skips conversations that were never loaded — they are
 * fetched fresh when opened — and messages that are already there
 * (the sender's own tab gets it from both the POST response and the socket).
 */
export const appendMessageToCache = (queryClient, userId, message) => {
  const queryKey = messagesQueryKey(userId);

  // A response already on its way may have been read before this message was
  // saved, and would overwrite the cache without it. Cancel it and fetch
  // again. (invalidateQueries alone is not enough: while a query has no data
  // yet, React Query joins the in-flight request instead of restarting it.)
  if (queryClient.getQueryState(queryKey)?.fetchStatus === "fetching") {
    queryClient
      .cancelQueries({ queryKey, exact: true })
      .then(() => queryClient.invalidateQueries({ queryKey, exact: true }));
  }

  queryClient.setQueryData(queryKey, (data) => {
    if (!data?.pages?.length) return data;

    const alreadyThere = data.pages.some((page) => page.messages.some((m) => m._id === message._id));
    if (alreadyThere) return data;

    const [newest, ...older] = data.pages;
    return {
      ...data,
      pages: [{ ...newest, messages: [...newest.messages, message] }, ...older],
    };
  });
};

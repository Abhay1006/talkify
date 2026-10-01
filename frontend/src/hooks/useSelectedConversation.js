import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import useConversation from "../zustand/useConversations";
import { conversationsQuery } from "../queries/conversations";

/**
 * The open conversation, kept current. The store holds the snapshot taken when
 * it was clicked (or picked from search); this overlays the latest contact-list
 * entry for the same user, so request status, name and avatar update as soon
 * as the list is refetched instead of staying frozen at click time.
 */
const useSelectedConversation = () => {
  const selected = useConversation((state) => state.selectedConversation);
  const { data: conversations } = useQuery(conversationsQuery);

  return useMemo(() => {
    if (!selected) return null;
    const fresh = conversations?.find((c) => c._id === selected._id);
    return fresh ? { ...selected, ...fresh } : selected;
  }, [selected, conversations]);
};

export default useSelectedConversation;

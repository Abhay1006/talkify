import { useState } from "react";
import useGetConversations from "../../hooks/useGetConversations";
import useConversationPrefs from "../../hooks/useConversationPrefs";
import useConversation from "../../zustand/useConversations";
import { useSocketContext } from "../../context/SocketContext";
import Conversation from "./Conversation";

const Conversations = () => {
  const { loading, conversations, isError, refetch } = useGetConversations();
  const selectedId = useConversation((state) => state.selectedConversation?._id);
  const unreadMessages = useConversation((state) => state.unreadMessages);
  const setSelectedConversation = useConversation((state) => state.setSelectedConversation);
  const { onlineUsers } = useSocketContext();
  const setPrefs = useConversationPrefs();
  const [showArchived, setShowArchived] = useState(false);

  const archived = conversations.filter((c) => c.archived);
  const visible = showArchived ? archived : conversations.filter((c) => !c.archived);
  // Pinned chats float to the top; otherwise keep the server's recency order.
  const ordered = [...visible.filter((c) => c.pinned), ...visible.filter((c) => !c.pinned)];

  return (
    <>
      <div className="sidebar-heading">
        {showArchived ? (
          <button type="button" className="btn-link" onClick={() => setShowArchived(false)}>
            ← Archived
          </button>
        ) : (
          "Conversations"
        )}
      </div>

      <nav className="convo-list" aria-label={showArchived ? "Archived conversations" : "Conversations"}>
        {loading && <div className="sidebar-empty">loading…</div>}

        {isError && (
          <div className="sidebar-empty">
            Couldn&apos;t load your conversations.{" "}
            <button type="button" className="btn-link" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        )}

        {!loading && !isError && conversations.length === 0 && (
          <div className="sidebar-empty">No conversations yet. Search a username to start one.</div>
        )}

        {ordered.map((conversation) => (
          <Conversation
            key={conversation._id}
            conversation={conversation}
            isSelected={conversation._id === selectedId}
            isOnline={onlineUsers.has(conversation._id)}
            unreadCount={unreadMessages[conversation._id] || 0}
            onSelect={setSelectedConversation}
            onChangePrefs={setPrefs}
          />
        ))}

        {showArchived && archived.length === 0 && <div className="sidebar-empty">No archived chats.</div>}

        {!showArchived && archived.length > 0 && (
          <button type="button" className="btn-link sidebar-more" onClick={() => setShowArchived(true)}>
            Archived ({archived.length})
          </button>
        )}
      </nav>
    </>
  );
};

export default Conversations;

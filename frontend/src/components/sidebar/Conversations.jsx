import useGetConversations from "../../hooks/useGetConversations";
import Conversation from "./Conversation";

const Conversations = () => {
  const { loading, conversations } = useGetConversations();

  return (
    <div className="convo-list">
      {conversations.map((conversation) => (
        <Conversation key={conversation._id} conversation={conversation} />
      ))}

      {loading && <div className="sidebar-empty">loading…</div>}

      {!loading && conversations.length === 0 && (
        <div className="sidebar-empty">No conversations yet. Search a username to start one.</div>
      )}
    </div>
  );
};

export default Conversations;

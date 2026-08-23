import { useSocketContext } from "../../context/SocketContext";
import useConversation from "../../zustand/useConversations";

const Conversation = ({ conversation }) => {
  const { selectedConversation, setSelectedConversation } = useConversation();
  const { unreadMessages } = useConversation();
  const { onlineUsers } = useSocketContext();

  const isSelected = selectedConversation?._id === conversation._id;
  const isOnline = onlineUsers.includes(conversation._id);
  const unreadCount = unreadMessages[conversation._id] || 0;

  return (
    <button
      type="button"
      className={`convo${isSelected ? " is-selected" : ""}`}
      onClick={() => setSelectedConversation(conversation)}
    >
      {/* Always rendered so names stay aligned as presence flips. */}
      <span
        className={`convo-dot${isOnline ? "" : " is-off"}`}
        title={isOnline ? "online" : "offline"}
      />
      <span className="convo-name">{conversation.username}</span>
      {unreadCount > 0 && <span className="convo-unread">{unreadCount}</span>}
    </button>
  );
};

export default Conversation;

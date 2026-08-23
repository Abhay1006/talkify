import { useAuthContext } from "../../context/AuthContext";
import { extractTime } from "../../utils/extractTime";
import useConversation from "../../zustand/useConversations.js";

// Consecutive messages from the same sender within this window share one
// header, which is what keeps a long thread readable without bubbles.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

const Message = ({ message, previous }) => {
  const { authUser } = useAuthContext();
  const { selectedConversation } = useConversation();
  const fromMe = message.senderId === authUser._id;

  const grouped =
    previous?.senderId === message.senderId &&
    new Date(message.createdAt) - new Date(previous.createdAt) < GROUP_WINDOW_MS;

  return (
    <div className={`msg${grouped ? " is-grouped" : ""}`}>
      {!grouped && (
        <div className="msg-meta">
          <span className={`msg-author${fromMe ? " is-mine" : ""}`}>
            {fromMe ? "you" : selectedConversation?.username}
          </span>
          <span className="msg-time">{extractTime(message.createdAt)}</span>
        </div>
      )}
      <div className="msg-body">{message.body}</div>
    </div>
  );
};

export default Message;

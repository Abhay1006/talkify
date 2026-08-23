import { useEffect, useLayoutEffect, useRef } from "react";
import useGetMessages from "../../hooks/useGetMessages";
import MessageSkeleton from "../skeletons/MessageSkeletons";
import Message from "./Message";
import useListenMessages from "../../hooks/useListenMessages";
import useConversation from "../../zustand/useConversations.js";

const Messages = () => {
  const { messages, loading } = useGetMessages();
  const { selectedConversation } = useConversation();
  useListenMessages();

  const listRef = useRef(null);
  const conversationId = selectedConversation?._id;
  // Opening a conversation should land at the bottom with no visible travel;
  // only messages arriving in an already-open thread animate.
  const jumpRef = useRef(true);

  useLayoutEffect(() => {
    jumpRef.current = true;
  }, [conversationId]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({
      top: list.scrollHeight,
      behavior: jumpRef.current ? "auto" : "smooth",
    });
    jumpRef.current = false;
  }, [messages, conversationId]);

  return (
    <div
      className="messages"
      ref={listRef}
      role="log"
      aria-label="Messages"
    >
      {loading && [...Array(4)].map((_, idx) => <MessageSkeleton key={idx} />)}

      {!loading &&
        messages.map((message, idx) => (
          <Message
            key={message._id}
            message={message}
            previous={messages[idx - 1]}
          />
        ))}

      {!loading && messages.length === 0 && (
        <div className="empty">No messages yet. Say something.</div>
      )}
    </div>
  );
};

export default Messages;

import { useEffect, useRef, useState } from "react";
import useSendMessage from "../../hooks/useSendMessages.js";
import useConversation from "../../zustand/useConversations.js";

const MessageInput = () => {
  const [message, setMessage] = useState("");
  const { loading, sendMessage } = useSendMessage();
  const { selectedConversation } = useConversation();
  const inputRef = useRef(null);

  useEffect(() => {
    // Focus only where a keyboard is actually attached; on touch devices this
    // would slam the on-screen keyboard open on every conversation switch.
    if (selectedConversation && window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus();
    }
  }, [selectedConversation]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = message.trim();
    if (!text || loading) return;
    // Cleared up front so the field is ready for the next line immediately.
    setMessage("");
    await sendMessage(text);
    inputRef.current?.focus();
  };

  return (
    <form className="chat-compose" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className="input"
        type="text"
        placeholder="Type a message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        autoComplete="off"
      />
      <button type="submit" className="btn btn-primary" disabled={loading || !message.trim()}>
        Send
      </button>
    </form>
  );
};

export default MessageInput;

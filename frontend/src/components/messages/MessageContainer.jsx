import { useEffect, useState } from "react";
import useConversation from "../../zustand/useConversations.js";
import MessageInput from "./MessageInput";
import Messages from "./Messages";
import { useAuthContext } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../context/ToastContext";
import { useSocketContext } from "../../context/SocketContext";

const MessageContainer = () => {
  const { selectedConversation, setSelectedConversation } = useConversation();
  const { authUser } = useAuthContext();
  const { onlineUsers } = useSocketContext();
  const isOnline = onlineUsers.includes(selectedConversation?._id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => setSelectedConversation(null);
  }, [setSelectedConversation]);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await apiClient.put(`/api/chat-requests/${selectedConversation.requestId}/accept`);
      setSelectedConversation({ ...selectedConversation, requestStatus: "accepted" });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast("Request accepted", "success");
    } catch (error) {
      toast("Failed to accept request", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async () => {
    setLoading(true);
    try {
      await apiClient.post(`/api/block/${selectedConversation._id}`);
      setSelectedConversation(null);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast("User blocked");
    } catch (error) {
      toast("Failed to block user", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!selectedConversation) {
    return (
      <section className="chat">
        <div className="empty">Select a conversation, or search a username to start one.</div>
      </section>
    );
  }

  const isPending = selectedConversation.requestStatus === "pending";
  const isPendingReceiver = isPending && selectedConversation.requestSenderId !== authUser._id;
  const isPendingSender = isPending && selectedConversation.requestSenderId === authUser._id;

  return (
    <section className="chat">
      <div className="chat-header">
        <button
          type="button"
          className="icon-btn back-btn"
          onClick={() => setSelectedConversation(null)}
          aria-label="Back to conversations"
        >
          ←
        </button>
        <span className="chat-title">{selectedConversation.username}</span>
        <span className={`chat-status${isOnline ? " is-online" : ""}`}>
          {isOnline ? "online" : "offline"}
        </span>
      </div>

      <Messages />

      {isPendingReceiver ? (
        <div className="notice">
          <div>
            <strong>{selectedConversation.username}</strong> wants to chat. Accept to reply.
          </div>
          <div className="notice-actions">
            <button type="button" className="btn btn-primary" onClick={handleAccept} disabled={loading}>
              Accept
            </button>
            <button type="button" className="btn" onClick={handleBlock} disabled={loading}>
              Block
            </button>
          </div>
        </div>
      ) : isPendingSender ? (
        <div className="notice">
          Waiting for {selectedConversation.username} to accept your request.
        </div>
      ) : (
        <MessageInput />
      )}
    </section>
  );
};

export default MessageContainer;

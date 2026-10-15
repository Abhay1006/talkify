import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import useConversation from "../../zustand/useConversations.js";
import useSelectedConversation from "../../hooks/useSelectedConversation";
import MessageInput from "./MessageInput";
import Messages from "./Messages";
import { useAuthContext } from "../../context/AuthContext";
import { useSocketContext } from "../../context/SocketContext";
import { useToast } from "../../context/ToastContext";
import { apiClient } from "../../api/client";
import { conversationsQueryKey } from "../../queries/conversations";
import useImageDraft from "../../hooks/useImageDraft";
import { startCall } from "../../calls/callEngine";
import { useCallStore } from "../../calls/callStore";

const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes("Files");

// Drag an image anywhere onto the open chat to attach it. dragenter/dragleave
// fire for every child crossed, so a depth count keeps the overlay steady.
const useImageDrop = (enabled) => {
  const { pickImage } = useImageDraft();
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  if (!enabled) return { dragging: false, handlers: {} };

  const handlers = {
    onDragEnter: (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver: (e) => {
      if (hasFiles(e)) e.preventDefault();
    },
    onDragLeave: (e) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop: (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      const files = [...e.dataTransfer.files];
      pickImage(files.find((f) => f.type.startsWith("image/")) ?? files[0]);
    },
  };
  return { dragging, handlers };
};

const CALL_KINDS = [
  { kind: "audio", label: "voice" },
  { kind: "video", label: "video" },
];

const MessageContainer = () => {
  const setSelectedConversation = useConversation((state) => state.setSelectedConversation);
  const selectedConversation = useSelectedConversation();
  const { authUser } = useAuthContext();
  const { onlineUsers } = useSocketContext();
  const isOnline = Boolean(selectedConversation && onlineUsers.has(selectedConversation._id));
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Which request action is in flight, so only that button shows progress.
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    return () => setSelectedConversation(null);
  }, [setSelectedConversation]);

  const runAction = async (action, request, { successMessage, variant, closeChat }) => {
    setPendingAction(action);
    try {
      await request();
      if (closeChat) setSelectedConversation(null);
      // The selected conversation is derived from this list, so refetching it
      // is what moves the UI on (e.g. from the request notice to the input).
      await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
      toast(successMessage, variant);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setPendingAction(null);
    }
  };

  const handleAccept = () =>
    runAction("accept", () => apiClient.put(`/api/chat-requests/${selectedConversation.requestId}/accept`), {
      successMessage: "Request accepted",
      variant: "success",
    });

  const handleDecline = () =>
    runAction("decline", () => apiClient.put(`/api/chat-requests/${selectedConversation.requestId}/reject`), {
      successMessage: "Request declined",
      variant: "info",
      closeChat: true,
    });

  const handleBlock = () =>
    runAction("block", () => apiClient.post(`/api/block/${selectedConversation._id}`), {
      successMessage: "User blocked",
      variant: "info",
      closeChat: true,
    });

  const isPending = selectedConversation?.requestStatus === "pending";
  const isPendingReceiver = isPending && selectedConversation.requestSenderId !== authUser._id;
  const isPendingSender = isPending && selectedConversation.requestSenderId === authUser._id;
  const canCompose = Boolean(selectedConversation) && !isPending;
  const { dragging, handlers: dropHandlers } = useImageDrop(canCompose);

  const inCall = useCallStore(
    (st) => Boolean(st.call) && !["ended", "failed", "error"].includes(st.call.phase)
  );
  // Calls need an accepted request (the server enforces it too).
  const callBlockedReason = !selectedConversation
    ? null
    : selectedConversation.requestStatus !== "accepted"
      ? "You can call once your chat request is accepted"
      : !isOnline
        ? `${selectedConversation.username} is offline`
        : inCall
          ? "You're already in a call"
          : null;

  const placeCall = (kind) => {
    // Asking now, from a click, is the only time browsers allow the prompt.
    // It lets a ringing call reach you when Talkify is in a background tab.
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    startCall(
      {
        _id: selectedConversation._id,
        fullName: selectedConversation.fullName,
        username: selectedConversation.username,
        profilePic: selectedConversation.profilePic,
      },
      kind
    );
  };

  if (!selectedConversation) {
    return (
      <section className="chat">
        <div className="empty">Select a conversation, or search a username to start one.</div>
      </section>
    );
  }

  return (
    <section className="chat" {...dropHandlers}>
      {dragging && (
        <div className="drop-overlay">
          <div>Drop an image to send</div>
          <div className="drop-overlay-sub">JPEG, PNG, WebP or GIF</div>
        </div>
      )}

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
        {selectedConversation.fullName && (
          <span className="chat-subtitle">{selectedConversation.fullName}</span>
        )}
        <span className={`chat-status${isOnline ? " is-online" : ""}`}>
          {isOnline ? "online" : "offline"}
        </span>
        <span className="chat-actions">
          {CALL_KINDS.map(({ kind, label }) => (
            <button
              key={kind}
              type="button"
              className="btn-link"
              onClick={() => placeCall(kind)}
              disabled={Boolean(callBlockedReason)}
              title={callBlockedReason ?? `${label} call`}
              aria-label={callBlockedReason ? `${label} call (${callBlockedReason})` : `${label} call`}
            >
              {label}
            </button>
          ))}
        </span>
      </div>

      {/* Keyed so scroll state starts fresh per chat. The keys are prefixed
          because Messages and MessageInput are siblings, and sharing a key
          made React mix them up when the composer swapped with a notice. */}
      <Messages key={`messages-${selectedConversation._id}`} conversation={selectedConversation} />

      {isPendingReceiver ? (
        <div className="notice">
          <div>
            <strong>{selectedConversation.username}</strong> wants to chat. Accept to reply.
          </div>
          <div className="notice-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAccept}
              disabled={pendingAction !== null}
            >
              {pendingAction === "accept" ? "…" : "Accept"}
            </button>
            <button type="button" className="btn" onClick={handleDecline} disabled={pendingAction !== null}>
              {pendingAction === "decline" ? "…" : "Decline"}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleBlock}
              disabled={pendingAction !== null}
            >
              {pendingAction === "block" ? "…" : "Block"}
            </button>
          </div>
        </div>
      ) : isPendingSender ? (
        <div className="notice">Waiting for {selectedConversation.username} to accept your request.</div>
      ) : (
        <MessageInput key={`input-${selectedConversation._id}`} receiverId={selectedConversation._id} />
      )}
    </section>
  );
};

export default MessageContainer;

import { useEffect, useRef, useState } from "react";
import { Box, Typography, Avatar, Button, CircularProgress, IconButton, Tooltip } from "@mui/material";
import {
  ArrowBack,
  ChatBubbleOutlined,
  ShieldOutlined,
  CallOutlined,
  VideocamOutlined,
  ImageOutlined,
} from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import useConversation from "../../zustand/useConversations.js";
import useSelectedConversation from "../../hooks/useSelectedConversation";
import MessageInput from "./MessageInput";
import Messages from "./Messages";
import { useAuthContext } from "../../context/AuthContext";
import { useSocketContext } from "../../context/SocketContext";
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
  { kind: "audio", label: "Voice call", Icon: CallOutlined },
  { kind: "video", label: "Video call", Icon: VideocamOutlined },
];

const MessageContainer = () => {
  const setSelectedConversation = useConversation((state) => state.setSelectedConversation);
  const selectedConversation = useSelectedConversation();
  const { authUser } = useAuthContext();
  const { onlineUsers } = useSocketContext();
  const isOnline = Boolean(selectedConversation && onlineUsers.has(selectedConversation._id));
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  // Which request action is in flight, so only that button shows a spinner.
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
      // is what moves the UI on (e.g. from "Message Request" to the input).
      await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
      enqueueSnackbar(successMessage, { variant });
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
    } finally {
      setPendingAction(null);
    }
  };

  const handleAccept = () =>
    runAction("accept", () => apiClient.put(`/api/chat-requests/${selectedConversation.requestId}/accept`), {
      successMessage: "Request accepted!",
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
        ? `${selectedConversation.fullName} is offline`
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
        profilePic: selectedConversation.profilePic,
      },
      kind
    );
  };

  return (
    <Box
      {...dropHandlers}
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: "rgba(255, 255, 255, 0.01)",
        minWidth: 0,
        position: "relative",
      }}
    >
      {dragging && (
        <Box
          sx={{
            position: "absolute",
            inset: 8,
            zIndex: 10,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            borderRadius: "20px",
            border: "2px dashed",
            borderColor: "primary.main",
            bgcolor: "rgba(11, 14, 26, 0.85)",
            color: "text.primary",
          }}
        >
          <ImageOutlined sx={{ fontSize: 36 }} />
          <Typography variant="body1" fontWeight={600}>
            Drop an image to send
          </Typography>
          <Typography variant="caption" color="text.secondary">
            JPEG, PNG, WebP or GIF
          </Typography>
        </Box>
      )}
      {!selectedConversation ? (
        <NoChatSelected />
      ) : (
        <>
          {/* Chat Header */}
          <Box
            sx={{
              px: { xs: 1.5, sm: 4 },
              py: { xs: 1.5, sm: 2 },
              borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              bgcolor: "rgba(255, 255, 255, 0.02)",
              backdropFilter: "blur(4px)",
              flexShrink: 0,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 2 }, minWidth: 0 }}>
              <IconButton
                aria-label="Back to conversations"
                onClick={() => setSelectedConversation(null)}
                sx={{
                  display: { xs: "inline-flex", md: "none" },
                  color: "text.primary",
                  p: 1,
                  mr: 0,
                  minWidth: 44,
                  minHeight: 44,
                }}
              >
                <ArrowBack />
              </IconButton>
              <Avatar
                src={selectedConversation.profilePic}
                alt=""
                variant="rounded"
                sx={{
                  width: { xs: 36, sm: 40 },
                  height: { xs: 36, sm: 40 },
                  border: "1px solid rgba(255,255,255,0.1)",
                  flexShrink: 0,
                }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="subtitle1"
                  fontWeight={600}
                  color="text.primary"
                  lineHeight={1.2}
                  noWrap
                  sx={{ fontSize: { xs: "0.9rem", sm: "1rem" } }}
                >
                  {selectedConversation.fullName}
                </Typography>
                <Typography
                  variant="caption"
                  fontWeight={500}
                  // sx, not the color prop: MUI v9 ignores palette paths there.
                  sx={{
                    fontSize: { xs: "0.65rem", sm: "0.75rem" },
                    color: isOnline ? "success.main" : "text.secondary",
                  }}
                >
                  {isOnline ? "Online" : "Offline"}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", gap: { xs: 0.5, sm: 1 }, flexShrink: 0 }}>
              {CALL_KINDS.map(({ kind, label, Icon }) => (
                <Tooltip key={kind} title={callBlockedReason ?? label}>
                  {/* span: a disabled button can't host a tooltip itself */}
                  <span>
                    <IconButton
                      onClick={() => placeCall(kind)}
                      disabled={Boolean(callBlockedReason)}
                      aria-label={callBlockedReason ? `${label} (${callBlockedReason})` : label}
                      sx={{
                        color: "text.primary",
                        minWidth: 44,
                        minHeight: 44,
                        "&:hover": { color: "primary.light" },
                      }}
                    >
                      <Icon />
                    </IconButton>
                  </span>
                </Tooltip>
              ))}
            </Box>
          </Box>

          {/* Messages Area. Keyed so scroll state starts fresh per chat. */}
          <Box sx={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>
            <Messages key={selectedConversation._id} conversation={selectedConversation} />
          </Box>

          {/* Input Area */}
          <Box
            className="chat-input-area"
            sx={{
              p: { xs: 1.5, sm: 3 },
              pb: { xs: "calc(env(safe-area-inset-bottom, 4px) + 8px)", sm: 3 },
              flexShrink: 0,
            }}
          >
            {isPendingReceiver ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  alignItems: "center",
                  p: { xs: 2, sm: 3 },
                  bgcolor: "rgba(108, 99, 255, 0.1)",
                  borderRadius: { xs: 3, sm: 4 },
                  border: "1px solid rgba(108, 99, 255, 0.2)",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.primary" }}>
                  <ShieldOutlined fontSize="small" />
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ fontSize: { xs: "0.8rem", sm: "0.875rem" } }}
                  >
                    Message Request
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign="center"
                  sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" } }}
                >
                  {selectedConversation.fullName} wants to chat with you. Accept to reply.
                </Typography>
                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center" }}>
                  <RequestButton
                    action="accept"
                    color="success"
                    pendingAction={pendingAction}
                    onClick={handleAccept}
                  >
                    Accept
                  </RequestButton>
                  <RequestButton
                    action="decline"
                    color="inherit"
                    pendingAction={pendingAction}
                    onClick={handleDecline}
                  >
                    Decline
                  </RequestButton>
                  <RequestButton
                    action="block"
                    color="error"
                    pendingAction={pendingAction}
                    onClick={handleBlock}
                  >
                    Block
                  </RequestButton>
                </Box>
              </Box>
            ) : isPendingSender ? (
              <Box
                sx={{
                  p: 2,
                  textAlign: "center",
                  bgcolor: "rgba(255, 255, 255, 0.05)",
                  borderRadius: { xs: 3, sm: 4 },
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" } }}
                >
                  Waiting for {selectedConversation.fullName} to accept your request...
                </Typography>
              </Box>
            ) : (
              <MessageInput key={selectedConversation._id} receiverId={selectedConversation._id} />
            )}
          </Box>
        </>
      )}
    </Box>
  );
};
export default MessageContainer;

const RequestButton = ({ action, color, pendingAction, onClick, children }) => (
  <Button
    variant={color === "inherit" ? "outlined" : "contained"}
    color={color}
    onClick={onClick}
    disabled={pendingAction !== null}
    sx={{ minWidth: { xs: 80, sm: 100 }, minHeight: 44 }}
  >
    {pendingAction === action ? (
      <CircularProgress size={20} color="inherit" aria-label="Working" />
    ) : (
      children
    )}
  </Button>
);

const CONNECTION_LABELS = {
  connected: { text: "Connected", color: "#4ade80" },
  connecting: { text: "Connecting…", color: "#facc15" },
  disconnected: { text: "Offline", color: "#f87171" },
};

const NoChatSelected = () => {
  const { authUser } = useAuthContext();
  const { status } = useSocketContext();
  const connection = CONNECTION_LABELS[status] ?? CONNECTION_LABELS.disconnected;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        bgcolor: "rgba(255, 255, 255, 0.01)",
      }}
    >
      <Box sx={{ px: { xs: 3, sm: 2 }, textAlign: "center", maxWidth: 400 }}>
        <Box
          sx={{
            width: { xs: 72, sm: 96 },
            height: { xs: 72, sm: 96 },
            bgcolor: "rgba(108, 99, 255, 0.1)",
            border: "1px solid rgba(108, 99, 255, 0.2)",
            borderRadius: { xs: 4, sm: 6 },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mx: "auto",
            mb: 3,
            boxShadow: "0 10px 25px -5px rgba(108, 99, 255, 0.1)",
          }}
        >
          <ChatBubbleOutlined sx={{ fontSize: 32, color: "primary.main" }} />
        </Box>
        <Box>
          <Typography
            variant="h5"
            fontWeight="bold"
            color="text.primary"
            gutterBottom
            sx={{ fontSize: { xs: "1.25rem", sm: "1.5rem" } }}
          >
            Welcome, {authUser.fullName.split(" ")[0]}!
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontWeight: 300, lineHeight: 1.6, mb: 3, fontSize: { xs: "0.8rem", sm: "0.875rem" } }}
          >
            Select a conversation from the sidebar to start messaging and sharing moments.
          </Typography>
        </Box>
        {/* Reflects the real socket state. It used to be a hard-coded green
            "Connected" that showed even with the server unreachable. */}
        <Box
          role="status"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            px: 2,
            py: 1,
            bgcolor: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            fontSize: "0.75rem",
            fontWeight: 500,
            color: "text.secondary",
          }}
        >
          <Box sx={{ width: 8, height: 8, bgcolor: connection.color, borderRadius: "50%", mr: 1 }} />
          {connection.text}
        </Box>
      </Box>
    </Box>
  );
};

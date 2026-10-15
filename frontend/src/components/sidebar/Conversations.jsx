import { useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { ArchiveOutlined, ChevronLeft } from "@mui/icons-material";
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

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
        <CircularProgress size={24} aria-label="Loading conversations" />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ textAlign: "center", mt: 2, px: 1 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Couldn&apos;t load your conversations.
        </Typography>
        <Button size="small" onClick={() => refetch()}>
          Try again
        </Button>
      </Box>
    );
  }

  if (conversations.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 1, mt: 1 }}>
        No conversations yet. Search for a username above to start one.
      </Typography>
    );
  }

  const archived = conversations.filter((c) => c.archived);
  const visible = showArchived ? archived : conversations.filter((c) => !c.archived);
  // Pinned chats float to the top; otherwise keep the server's recency order.
  const ordered = [...visible.filter((c) => c.pinned), ...visible.filter((c) => !c.pinned)];
  const linkSx = {
    alignSelf: "flex-start",
    px: 1.5,
    py: 0.75,
    color: "text.secondary",
    background: "none",
    "&:hover": { background: "rgba(255,255,255,0.05)", boxShadow: "none" },
  };

  return (
    <Box
      component="nav"
      aria-label={showArchived ? "Archived conversations" : "Conversations"}
      sx={{ display: "flex", flexDirection: "column", overflow: "auto" }}
    >
      {showArchived && (
        <Button onClick={() => setShowArchived(false)} startIcon={<ChevronLeft />} sx={{ ...linkSx, mb: 1 }}>
          Archived chats
        </Button>
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

      {showArchived && archived.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
          No archived chats.
        </Typography>
      )}

      {!showArchived && archived.length > 0 && (
        <Button
          onClick={() => setShowArchived(true)}
          startIcon={<ArchiveOutlined />}
          sx={{ ...linkSx, mt: 1 }}
        >
          Archived ({archived.length})
        </Button>
      )}
    </Box>
  );
};
export default Conversations;

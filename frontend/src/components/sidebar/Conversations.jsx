import { useState } from "react";
import useGetConversations from "../../hooks/useGetConversations";
import Conversation from "./Conversation";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { FiArchive, FiChevronLeft } from "react-icons/fi";

const Conversations = () => {
  const { loading, conversations } = useGetConversations();
  const [showArchived, setShowArchived] = useState(false);

  const archived = conversations.filter((c) => c.archived);
  const visible = showArchived ? archived : conversations.filter((c) => !c.archived);
  // Pinned chats float to the top; otherwise keep the server's recency order.
  const ordered = [...visible.filter((c) => c.pinned), ...visible.filter((c) => !c.pinned)];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      {showArchived && (
        <Button
          onClick={() => setShowArchived(false)}
          startIcon={<FiChevronLeft />}
          sx={{ alignSelf: 'flex-start', mb: 1, px: 1, py: 0.5, color: 'text.secondary', background: 'none', '&:hover': { background: 'rgba(255,255,255,0.05)', boxShadow: 'none' } }}
        >
          Archived chats
        </Button>
      )}

      {ordered.map((conversation, idx) => (
        <Conversation
          key={conversation._id}
          conversation={conversation}
          lastIdx={idx === ordered.length - 1}
        />
      ))}

      {!loading && showArchived && archived.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>No archived chats.</Typography>
      )}

      {!showArchived && archived.length > 0 && (
        <Button
          onClick={() => setShowArchived(true)}
          startIcon={<FiArchive />}
          sx={{ alignSelf: 'flex-start', mt: 1, px: 1.5, py: 0.75, color: 'text.secondary', background: 'none', '&:hover': { background: 'rgba(255,255,255,0.05)', boxShadow: 'none' } }}
        >
          Archived ({archived.length})
        </Button>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : null}
    </Box>
  );
};
export default Conversations;

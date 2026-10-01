import { Box, Button, CircularProgress, Typography } from "@mui/material";
import useGetConversations from "../../hooks/useGetConversations";
import useConversation from "../../zustand/useConversations";
import { useSocketContext } from "../../context/SocketContext";
import Conversation from "./Conversation";

const Conversations = () => {
  const { loading, conversations, isError, refetch } = useGetConversations();
  const selectedId = useConversation((state) => state.selectedConversation?._id);
  const unreadMessages = useConversation((state) => state.unreadMessages);
  const setSelectedConversation = useConversation((state) => state.setSelectedConversation);
  const { onlineUsers } = useSocketContext();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <CircularProgress size={24} aria-label="Loading conversations" />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ textAlign: 'center', mt: 2, px: 1 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Couldn&apos;t load your conversations.
        </Typography>
        <Button size="small" onClick={() => refetch()}>Try again</Button>
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

  return (
    <Box component="nav" aria-label="Conversations" sx={{ display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      {conversations.map((conversation) => (
        <Conversation
          key={conversation._id}
          conversation={conversation}
          isSelected={conversation._id === selectedId}
          isOnline={onlineUsers.has(conversation._id)}
          unreadCount={unreadMessages[conversation._id] || 0}
          onSelect={setSelectedConversation}
        />
      ))}
    </Box>
  );
};
export default Conversations;

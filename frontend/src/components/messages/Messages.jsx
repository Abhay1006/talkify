import { useEffect, useRef } from "react";
import useGetMessages from "../../hooks/useGetMessages";
import MessageSkeleton from "../skeletons/MessageSkeletons";
import Message from "./Message";
import useListenMessages from "../../hooks/useListenMessages";
import { Box, Typography } from "@mui/material";

const Messages = () => {
  const { messages, loading } = useGetMessages();
  useListenMessages();
  const lastMessageRef = useRef();

  useEffect(() => {
    setTimeout(() => {
      lastMessageRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [messages]);

  return (
    <Box sx={{
      px: { xs: 1.5, sm: 4 },
      py: { xs: 1, sm: 2 },
      flex: 1,
      overflow: 'auto',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      WebkitOverflowScrolling: 'touch',
      overscrollBehaviorY: 'contain',
    }}>
      {!loading &&
        messages.length > 0 &&
        messages.map((message) => (
          <Box key={message._id} ref={lastMessageRef}>
            <Message message={message} />
          </Box>
        ))}

      {loading && [...Array(3)].map((_, idx) => <MessageSkeleton key={idx} />)}
      
      {!loading && messages.length === 0 && (
        <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
            Send a message to start the conversation
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Messages;

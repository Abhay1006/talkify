import useGetConversations from "../../hooks/useGetConversations";
import Conversation from "./Conversation";
import { Box, CircularProgress } from "@mui/material";

const Conversations = () => {
  const { loading, conversations } = useGetConversations();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      {conversations.map((conversation, idx) => (
        <Conversation
          key={conversation._id}
          conversation={conversation}
          lastIdx={idx === conversations.length - 1}
        />
      ))}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : null}
    </Box>
  );
};
export default Conversations;

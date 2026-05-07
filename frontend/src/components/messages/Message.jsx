import { useAuthContext } from "../../context/AuthContext";
import { extractTime } from "../../utils/extractTime";
import useConversation from "../../zustand/useConversations.js";
import { Box, Typography, Avatar } from "@mui/material";

const Message = ({ message }) => {
  const { authUser } = useAuthContext();
  const { selectedConversation } = useConversation();
  const fromMe = message.senderId === authUser._id;
  const formattedTime = extractTime(message.createdAt);
  
  const profilePic = fromMe
    ? authUser.profilePic
    : selectedConversation?.profilePic;
    
  return (
    <Box sx={{ display: 'flex', width: '100%', mb: 3, justifyContent: fromMe ? 'flex-end' : 'flex-start' }}>
      <Box sx={{ display: 'flex', maxWidth: '80%', flexDirection: fromMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 1 }}>
        
        <Box sx={{ flexShrink: 0, mb: 0.5 }}>
          <Avatar src={profilePic} variant="rounded" sx={{ width: 32, height: 32, border: '1px solid rgba(255,255,255,0.1)' }} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: fromMe ? 'flex-end' : 'flex-start' }}>
          <Box
            sx={{
              px: 2.5, py: 1.5,
              borderRadius: 3,
              fontSize: '0.875rem',
              wordBreak: 'break-word',
              ...(fromMe ? {
                bgcolor: 'primary.main',
                color: 'white',
                borderBottomRightRadius: 0,
                boxShadow: '0 4px 14px 0 rgba(108, 99, 255, 0.1)'
              } : {
                bgcolor: 'rgba(255,255,255,0.05)',
                color: 'text.primary',
                borderBottomLeftRadius: 0,
                border: '1px solid rgba(255,255,255,0.05)'
              })
            }}
          >
            {message.message || message.ciphertext}
          </Box>
          <Typography variant="caption" sx={{ mt: 0.5, px: 0.5, color: 'text.secondary', fontSize: '0.625rem', fontWeight: 500, textTransform: 'uppercase' }}>
            {formattedTime}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
export default Message;

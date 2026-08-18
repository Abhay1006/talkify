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
    <Box sx={{ display: 'flex', width: '100%', mb: { xs: 1.5, sm: 3 }, justifyContent: fromMe ? 'flex-end' : 'flex-start' }}>
      <Box sx={{ display: 'flex', maxWidth: { xs: '85%', sm: '80%' }, flexDirection: fromMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: { xs: 0.5, sm: 1 } }}>
        
        {/* Avatar — hidden on mobile for cleaner look */}
        <Box sx={{ flexShrink: 0, mb: 0.5, display: { xs: 'none', sm: 'block' } }}>
          <Avatar src={profilePic} variant="rounded" sx={{ width: 32, height: 32, border: '1px solid rgba(255,255,255,0.1)' }} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: fromMe ? 'flex-end' : 'flex-start', minWidth: 0 }}>
          <Box
            sx={{
              px: { xs: 2, sm: 2.5 }, py: { xs: 1, sm: 1.5 },
              borderRadius: { xs: 2.5, sm: 3 },
              fontSize: { xs: '0.8125rem', sm: '0.875rem' },
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
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
            {message.body}
          </Box>
          <Typography variant="caption" sx={{ mt: 0.5, px: 0.5, color: 'text.secondary', fontSize: { xs: '0.55rem', sm: '0.625rem' }, fontWeight: 500, textTransform: 'uppercase' }}>
            {formattedTime}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
export default Message;

import { useSocketContext } from "../../context/SocketContext";
import useConversation from "../../zustand/useConversations";
import { Box, Typography, Avatar, Badge } from "@mui/material";
import { styled } from '@mui/material/styles';

const StyledBadge = styled(Badge)(({ theme }) => ({
  '& .MuiBadge-badge': {
    backgroundColor: '#44b700',
    color: '#44b700',
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    '&::after': {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      animation: 'ripple 1.2s infinite ease-in-out',
      border: '1px solid currentColor',
      content: '""',
    },
  },
  '@keyframes ripple': {
    '0%': { transform: 'scale(.8)', opacity: 1 },
    '100%': { transform: 'scale(2.4)', opacity: 0 },
  },
}));

const Conversation = ({ conversation }) => {
  const { selectedConversation, setSelectedConversation, unreadMessages } = useConversation();
  const isSelected = selectedConversation?._id === conversation._id;
  const { onlineUsers } = useSocketContext();
  const isOnline = onlineUsers.includes(conversation._id);
  const unreadCount = unreadMessages[conversation._id] || 0;

  return (
    <Box
      onClick={() => setSelectedConversation(conversation)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 1.5,
        borderRadius: 3,
        cursor: 'pointer',
        transition: 'all 0.2s',
        mb: 0.5,
        bgcolor: isSelected ? 'primary.main' : 'transparent',
        '&:hover': {
          bgcolor: isSelected ? 'primary.main' : 'rgba(255, 255, 255, 0.05)',
        }
      }}
    >
      <Box sx={{ position: 'relative' }}>
        {isOnline ? (
          <StyledBadge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} variant="dot">
            <Avatar src={conversation.profilePic} variant="rounded" sx={{ width: 48, height: 48 }} />
          </StyledBadge>
        ) : (
          <Avatar src={conversation.profilePic} variant="rounded" sx={{ width: 48, height: 48 }} />
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" fontWeight={600} color={isSelected ? 'white' : 'text.primary'} noWrap>
            {conversation.fullName}
          </Typography>
          {unreadCount > 0 && (
            <Badge badgeContent={unreadCount} color="error" sx={{ mr: 1, '& .MuiBadge-badge': { position: 'static', transform: 'none' } }} />
          )}
        </Box>
        <Typography variant="caption" color={isSelected ? 'rgba(255,255,255,0.8)' : 'text.secondary'} noWrap>
          {isOnline ? "Online" : "Offline"}
        </Typography>
      </Box>
    </Box>
  );
};

export default Conversation;

import { useSocketContext } from "../../context/SocketContext";
import useConversation from "../../zustand/useConversations";
import { useState } from "react";
import { Box, Typography, Avatar, Badge, IconButton, Menu, MenuItem, ListItemIcon } from "@mui/material";
import { FiMoreVertical, FiArchive, FiBellOff, FiBell } from "react-icons/fi";
import { BsPinAngle, BsPinAngleFill } from "react-icons/bs";
import useConversationPrefs from "../../hooks/useConversationPrefs";
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
  const setPrefs = useConversationPrefs();
  const [menuAnchor, setMenuAnchor] = useState(null);

  const choose = (patch) => {
    setMenuAnchor(null);
    setPrefs(conversation._id, patch);
  };

  return (
    <Box
      onClick={() => setSelectedConversation(conversation)}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuAnchor(e.currentTarget.querySelector('.conversation-menu'));
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.5, sm: 2 },
        p: { xs: 1.5, sm: 1.5 },
        borderRadius: 3,
        cursor: 'pointer',
        transition: 'all 0.2s',
        mb: 0.5,
        minHeight: 56,
        bgcolor: isSelected ? 'primary.main' : 'transparent',
        '&:hover': {
          bgcolor: isSelected ? 'primary.main' : 'rgba(255, 255, 255, 0.05)',
        },
        '&:active': {
          transform: 'scale(0.98)',
        },
        '&:hover .conversation-menu, & .conversation-menu:focus-visible, & .conversation-menu[aria-expanded="true"]': { opacity: 1 },
      }}
    >
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        {isOnline ? (
          <StyledBadge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} variant="dot">
            <Avatar src={conversation.profilePic} variant="rounded" sx={{ width: { xs: 42, sm: 48 }, height: { xs: 42, sm: 48 } }} />
          </StyledBadge>
        ) : (
          <Avatar src={conversation.profilePic} variant="rounded" sx={{ width: { xs: 42, sm: 48 }, height: { xs: 42, sm: 48 } }} />
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' }, color: isSelected ? 'white' : 'text.primary', flex: 1, minWidth: 0 }}>
            {conversation.fullName}
          </Typography>
          {conversation.muted && <FiBellOff size={12} role="img" aria-label="Muted" style={{ opacity: 0.6, flexShrink: 0 }} />}
          {conversation.pinned && <BsPinAngleFill size={12} role="img" aria-label="Pinned" style={{ opacity: 0.6, flexShrink: 0 }} />}
          {unreadCount > 0 && (
            <Badge badgeContent={unreadCount} color="error" sx={{ mr: 1, '& .MuiBadge-badge': { position: 'static', transform: 'none' } }} />
          )}
        </Box>
        <Typography variant="caption" noWrap sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, color: isSelected ? 'rgba(255,255,255,0.8)' : 'text.secondary' }}>
          {isOnline ? "Online" : "Offline"}
        </Typography>
      </Box>

      <IconButton
        className="conversation-menu"
        size="small"
        aria-label={`Options for ${conversation.fullName}`}
        aria-haspopup="menu"
        aria-expanded={menuAnchor ? 'true' : 'false'}
        onClick={(e) => {
          e.stopPropagation();
          setMenuAnchor(e.currentTarget);
        }}
        sx={{ flexShrink: 0, opacity: 0, transition: 'opacity 120ms', color: isSelected ? 'white' : 'text.secondary', '@media (hover: none)': { opacity: 0.7 } }}
      >
        <FiMoreVertical size={16} />
      </IconButton>
      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
        slotProps={{ paper: { sx: { bgcolor: '#1a1d33', backdropFilter: 'none', backgroundImage: 'none', borderRadius: '12px', minWidth: 180 } } }}
      >
        <MenuItem onClick={() => choose({ pinned: !conversation.pinned })}>
          <ListItemIcon>{conversation.pinned ? <BsPinAngle /> : <BsPinAngleFill />}</ListItemIcon>
          {conversation.pinned ? 'Unpin' : 'Pin to top'}
        </MenuItem>
        <MenuItem onClick={() => choose({ muted: !conversation.muted })}>
          <ListItemIcon>{conversation.muted ? <FiBell /> : <FiBellOff />}</ListItemIcon>
          {conversation.muted ? 'Unmute' : 'Mute notifications'}
        </MenuItem>
        <MenuItem onClick={() => choose({ archived: !conversation.archived })}>
          <ListItemIcon><FiArchive /></ListItemIcon>
          {conversation.archived ? 'Unarchive' : 'Archive'}
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Conversation;

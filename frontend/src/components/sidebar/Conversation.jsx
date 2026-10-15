import { memo, useState } from "react";
import {
  Box,
  Typography,
  Avatar,
  Badge,
  ButtonBase,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import {
  MoreVert,
  ArchiveOutlined,
  UnarchiveOutlined,
  NotificationsOffOutlined,
  NotificationsOutlined,
  PushPin,
  PushPinOutlined,
} from "@mui/icons-material";

const StyledBadge = styled(Badge)(({ theme }) => ({
  "& .MuiBadge-badge": {
    backgroundColor: "#44b700",
    color: "#44b700",
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    "&::after": {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      animation: "ripple 1.2s infinite ease-in-out",
      border: "1px solid currentColor",
      content: '""',
    },
  },
  "@keyframes ripple": {
    "0%": { transform: "scale(.8)", opacity: 1 },
    "100%": { transform: "scale(2.4)", opacity: 0 },
  },
}));

const describe = ({ conversation, isOnline, unreadCount }) =>
  [
    conversation.fullName,
    conversation.pinned ? "pinned" : null,
    conversation.muted ? "muted" : null,
    isOnline ? "online" : "offline",
    unreadCount > 0 ? `${unreadCount} unread` : null,
  ]
    .filter(Boolean)
    .join(", ");

// Pin / mute / archive. A sibling of the row's button, not inside it: a
// button inside a button is invalid and breaks keyboard and screen readers.
const ConversationMenu = ({ conversation, isSelected, onChangePrefs }) => {
  const [anchor, setAnchor] = useState(null);
  const choose = (patch) => {
    setAnchor(null);
    onChangePrefs(conversation._id, patch);
  };

  return (
    <>
      <IconButton
        className="conversation-menu"
        size="small"
        aria-label={`Options for ${conversation.fullName}`}
        aria-haspopup="menu"
        aria-expanded={anchor ? "true" : "false"}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          opacity: 0,
          transition: "opacity 120ms",
          color: isSelected ? "white" : "text.secondary",
          "@media (hover: none)": { opacity: 0.7 },
        }}
      >
        <MoreVert sx={{ fontSize: 18 }} />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "#1a1d33",
              backdropFilter: "none",
              backgroundImage: "none",
              borderRadius: "12px",
              minWidth: 190,
            },
          },
        }}
      >
        <MenuItem onClick={() => choose({ pinned: !conversation.pinned })}>
          <ListItemIcon>
            {conversation.pinned ? <PushPinOutlined fontSize="small" /> : <PushPin fontSize="small" />}
          </ListItemIcon>
          {conversation.pinned ? "Unpin" : "Pin to top"}
        </MenuItem>
        <MenuItem onClick={() => choose({ muted: !conversation.muted })}>
          <ListItemIcon>
            {conversation.muted ? (
              <NotificationsOutlined fontSize="small" />
            ) : (
              <NotificationsOffOutlined fontSize="small" />
            )}
          </ListItemIcon>
          {conversation.muted ? "Unmute" : "Mute notifications"}
        </MenuItem>
        <MenuItem onClick={() => choose({ archived: !conversation.archived })}>
          <ListItemIcon>
            {conversation.archived ? (
              <UnarchiveOutlined fontSize="small" />
            ) : (
              <ArchiveOutlined fontSize="small" />
            )}
          </ListItemIcon>
          {conversation.archived ? "Unarchive" : "Archive"}
        </MenuItem>
      </Menu>
    </>
  );
};

// A real button (ButtonBase) rather than a clickable Box, so it can be reached
// and opened from the keyboard and is announced properly by screen readers.
const Conversation = ({ conversation, isSelected, isOnline, unreadCount, onSelect, onChangePrefs }) => {
  const avatar = (
    <Avatar
      src={conversation.profilePic}
      alt=""
      variant="rounded"
      sx={{ width: { xs: 42, sm: 48 }, height: { xs: 42, sm: 48 } }}
    />
  );

  return (
    <Box
      sx={{
        position: "relative",
        mb: 0.5,
        '&:hover .conversation-menu, & .conversation-menu:focus-visible, & .conversation-menu[aria-expanded="true"]':
          {
            opacity: 1,
          },
      }}
    >
      <ButtonBase
        onClick={() => onSelect(conversation)}
        onContextMenu={(e) => {
          // Right-click opens the same menu as the ⋮ button.
          e.preventDefault();
          e.currentTarget.parentElement.querySelector(".conversation-menu")?.click();
        }}
        aria-current={isSelected ? "true" : undefined}
        aria-label={describe({ conversation, isOnline, unreadCount })}
        sx={{
          display: "flex",
          width: "100%",
          justifyContent: "flex-start",
          textAlign: "left",
          alignItems: "center",
          gap: { xs: 1.5, sm: 2 },
          p: 1.5,
          pr: 5,
          borderRadius: 3,
          transition: "all 0.2s",
          minHeight: 56,
          bgcolor: isSelected ? "primary.main" : "transparent",
          "&:hover": {
            bgcolor: isSelected ? "primary.main" : "rgba(255, 255, 255, 0.05)",
          },
          "&.Mui-focusVisible": {
            outline: "2px solid",
            outlineColor: "primary.light",
          },
          "&:active": {
            transform: "scale(0.98)",
          },
        }}
      >
        <Box sx={{ position: "relative", flexShrink: 0 }}>
          {isOnline ? (
            <StyledBadge
              overlap="circular"
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              variant="dot"
            >
              {avatar}
            </StyledBadge>
          ) : (
            avatar
          )}
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 0.5 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              noWrap
              sx={{
                fontSize: { xs: "0.8rem", sm: "0.875rem" },
                color: isSelected ? "white" : "text.primary",
                flex: 1,
                minWidth: 0,
              }}
            >
              {conversation.fullName}
            </Typography>
            {conversation.muted && (
              <NotificationsOffOutlined aria-hidden sx={{ fontSize: 14, opacity: 0.6, flexShrink: 0 }} />
            )}
            {conversation.pinned && (
              <PushPin aria-hidden sx={{ fontSize: 14, opacity: 0.6, flexShrink: 0 }} />
            )}
            {unreadCount > 0 && (
              <Badge
                badgeContent={unreadCount}
                color="error"
                sx={{ mr: 1, "& .MuiBadge-badge": { position: "static", transform: "none" } }}
              />
            )}
          </Box>
          <Typography
            variant="caption"
            color={isSelected ? "rgba(255,255,255,0.8)" : "text.secondary"}
            noWrap
            sx={{ fontSize: { xs: "0.65rem", sm: "0.75rem" } }}
          >
            {isOnline ? "Online" : "Offline"}
          </Typography>
        </Box>
      </ButtonBase>
      {onChangePrefs && (
        <ConversationMenu conversation={conversation} isSelected={isSelected} onChangePrefs={onChangePrefs} />
      )}
    </Box>
  );
};

export default memo(Conversation);

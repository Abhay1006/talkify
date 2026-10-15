import { memo } from "react";
import { Box, Typography, Avatar, Badge, ButtonBase } from "@mui/material";
import { styled } from "@mui/material/styles";

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
  [conversation.fullName, isOnline ? "online" : "offline", unreadCount > 0 ? `${unreadCount} unread` : null]
    .filter(Boolean)
    .join(", ");

// A real button (ButtonBase) rather than a clickable Box, so it can be reached
// and opened from the keyboard and is announced properly by screen readers.
const Conversation = ({ conversation, isSelected, isOnline, unreadCount, onSelect }) => {
  const avatar = (
    <Avatar
      src={conversation.profilePic}
      alt=""
      variant="rounded"
      sx={{ width: { xs: 42, sm: 48 }, height: { xs: 42, sm: 48 } }}
    />
  );

  return (
    <ButtonBase
      onClick={() => onSelect(conversation)}
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
        borderRadius: 3,
        transition: "all 0.2s",
        mb: 0.5,
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
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography
            variant="body2"
            fontWeight={600}
            color={isSelected ? "white" : "text.primary"}
            noWrap
            sx={{ fontSize: { xs: "0.8rem", sm: "0.875rem" } }}
          >
            {conversation.fullName}
          </Typography>
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
  );
};

export default memo(Conversation);

import { memo, useRef, useState } from "react";
import {
  Box,
  Typography,
  Avatar,
  Button,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
} from "@mui/material";
import {
  ErrorOutlineOutlined,
  CallOutlined,
  PhoneMissedOutlined,
  VideocamOutlined,
  MoreHoriz,
  EditOutlined,
  ContentCopyOutlined,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { formatMessageTime } from "../../utils/formatMessageTime";
import { mediaUrl } from "../../utils/prepareImage";
import { imageSrcSet } from "../../utils/messageImage";
import { historyLabel } from "../../calls/callText";
import { startCall } from "../../calls/callEngine";
import { useCallStore } from "../../calls/callStore";
import useConversation from "../../zustand/useConversations.js";
import MessageImage from "./MessageImage";
import { LinkifiedText, LinkPreviewCard } from "./MessageText";
import VoiceMessage from "./VoiceMessage";

// Mirrors EDIT_WINDOW_MS in backend/controllers/message.controller.js.
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const LONG_PRESS_MS = 500;

const bubbleSx = (fromMe, hasImage) => ({
  ...(hasImage ? { p: 0.5 } : { px: { xs: 2, sm: 2.5 }, py: { xs: 1, sm: 1.5 } }),
  borderRadius: { xs: 2.5, sm: 3 },
  fontSize: { xs: "0.8125rem", sm: "0.875rem" },
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap",
  ...(fromMe
    ? {
        bgcolor: "primary.main",
        color: "white",
        borderBottomRightRadius: 0,
        boxShadow: "0 4px 14px 0 rgba(108, 99, 255, 0.1)",
      }
    : {
        bgcolor: "rgba(255,255,255,0.05)",
        color: "text.primary",
        borderBottomLeftRadius: 0,
        border: "1px solid rgba(255,255,255,0.05)",
      }),
});

const captionSx = { px: { xs: 1.5, sm: 2 }, pt: 0.75, pb: 0.5 };

const footerSx = {
  mt: 0.5,
  px: 0.5,
  color: "text.secondary",
  fontSize: { xs: "0.55rem", sm: "0.625rem" },
  fontWeight: 500,
  textTransform: "uppercase",
};

const Time = ({ value, children }) => {
  const createdAt = new Date(value);
  return (
    <Typography
      component="time"
      dateTime={Number.isNaN(createdAt.getTime()) ? undefined : createdAt.toISOString()}
      variant="caption"
      sx={footerSx}
    >
      {formatMessageTime(value)}
      {children}
    </Typography>
  );
};

const MessageRow = ({ fromMe, profilePic, bubble, footer, actions, rowProps }) => (
  <Box
    {...rowProps}
    sx={{
      display: "flex",
      width: "100%",
      mb: { xs: 1.5, sm: 3 },
      justifyContent: fromMe ? "flex-end" : "flex-start",
      '&:hover .message-actions, & .message-actions:focus-visible, & .message-actions[aria-expanded="true"]':
        {
          opacity: 1,
        },
    }}
  >
    <Box
      sx={{
        display: "flex",
        maxWidth: { xs: "85%", sm: "80%" },
        flexDirection: fromMe ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: { xs: 0.5, sm: 1 },
      }}
    >
      {/* Avatar — hidden on mobile for cleaner look */}
      <Box sx={{ flexShrink: 0, mb: 0.5, display: { xs: "none", sm: "block" } }}>
        <Avatar
          src={profilePic}
          alt=""
          variant="rounded"
          sx={{ width: 32, height: 32, border: "1px solid rgba(255,255,255,0.1)" }}
        />
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: fromMe ? "flex-end" : "flex-start",
          minWidth: 0,
        }}
      >
        {bubble}
        {footer}
      </Box>
      {actions}
    </Box>
  </Box>
);

// Copy / Edit. Opens from the ⋯ button (shown on hover), a right-click or a
// long press.
const useMessageMenu = (message, fromMe) => {
  const setEditingMessage = useConversation((state) => state.setEditingMessage);
  const { enqueueSnackbar } = useSnackbar();
  const [anchor, setAnchor] = useState(null);
  const buttonRef = useRef(null);
  const pressTimer = useRef(null);

  const canEdit =
    fromMe &&
    !message.voice &&
    !message.call &&
    Date.now() - new Date(message.createdAt).getTime() < EDIT_WINDOW_MS;
  const canCopy = Boolean(message.body);
  if (!canEdit && !canCopy) return { actions: null, rowProps: undefined };

  const close = () => setAnchor(null);
  const copy = async () => {
    close();
    try {
      await navigator.clipboard.writeText(message.body);
      enqueueSnackbar("Copied", { variant: "success", autoHideDuration: 1500 });
    } catch {
      enqueueSnackbar("Couldn't copy", { variant: "warning" });
    }
  };

  const rowProps = {
    onContextMenu: (e) => {
      if (window.getSelection()?.toString()) return;
      e.preventDefault();
      setAnchor(buttonRef.current);
    },
    onTouchStart: () => {
      pressTimer.current = setTimeout(() => setAnchor(buttonRef.current), LONG_PRESS_MS);
    },
    onTouchEnd: () => clearTimeout(pressTimer.current),
    onTouchMove: () => clearTimeout(pressTimer.current),
  };

  const actions = (
    <>
      <IconButton
        ref={buttonRef}
        className="message-actions"
        size="small"
        aria-label="Message options"
        aria-haspopup="menu"
        aria-expanded={anchor ? "true" : "false"}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          alignSelf: "center",
          opacity: 0,
          transition: "opacity 120ms",
          color: "text.secondary",
          width: 32,
          height: 32,
          // Touch devices use long press; keep the anchor but take no space.
          "@media (hover: none)": { width: 0, overflow: "hidden", p: 0 },
        }}
      >
        <MoreHoriz sx={{ fontSize: 18 }} />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: "top", horizontal: fromMe ? "left" : "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: fromMe ? "right" : "left" }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "#1a1d33",
              backdropFilter: "none",
              backgroundImage: "none",
              borderRadius: "12px",
              minWidth: 160,
            },
          },
        }}
      >
        {canCopy && (
          <MenuItem onClick={copy}>
            <ListItemIcon>
              <ContentCopyOutlined fontSize="small" />
            </ListItemIcon>
            Copy text
          </MenuItem>
        )}
        {canEdit && (
          <MenuItem
            onClick={() => {
              close();
              setEditingMessage(message);
            }}
          >
            <ListItemIcon>
              <EditOutlined fontSize="small" />
            </ListItemIcon>
            Edit
          </MenuItem>
        )}
      </Menu>
    </>
  );

  return { actions, rowProps };
};

// "Voice call · 2:31", "Missed video call" — centred, like a system line, with
// a one-tap call back.
const CallHistoryMessage = ({ message, fromMe, peer }) => {
  const busy = useCallStore(
    (st) => Boolean(st.call) && !["ended", "failed", "error"].includes(st.call.phase)
  );
  const { call } = message;
  const missed = call.status !== "completed" && !fromMe;
  const Icon = missed ? PhoneMissedOutlined : call.kind === "video" ? VideocamOutlined : CallOutlined;

  return (
    <Box sx={{ display: "flex", justifyContent: "center", mb: { xs: 1.5, sm: 2.5 } }}>
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          pl: 1.5,
          pr: 0.5,
          py: 0.5,
          borderRadius: "999px",
          bgcolor: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.06)",
          maxWidth: "100%",
        }}
      >
        <Icon aria-hidden sx={{ fontSize: 16, color: missed ? "error.light" : "text.secondary" }} />
        <Typography
          variant="body2"
          sx={{
            fontSize: { xs: "0.75rem", sm: "0.8125rem" },
            color: missed ? "error.light" : "text.primary",
          }}
        >
          {historyLabel(call, fromMe)}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.625rem" }}>
          {formatMessageTime(message.createdAt)}
        </Typography>
        <Button
          size="small"
          disabled={busy || !peer}
          onClick={() =>
            startCall({ _id: peer._id, fullName: peer.fullName, profilePic: peer.profilePic }, call.kind)
          }
          sx={{
            minWidth: 0,
            px: 1.25,
            py: 0.25,
            fontSize: "0.75rem",
            borderRadius: "999px",
            background: "none",
          }}
        >
          Call back
        </Button>
      </Box>
    </Box>
  );
};

const ChatMessage = ({ message, fromMe, profilePic, onOpenImage }) => {
  const { actions, rowProps } = useMessageMenu(message, fromMe);
  const beingEdited = useConversation((state) => state.editingMessage?._id === message._id);
  const { image, voice, linkPreview } = message;

  return (
    <MessageRow
      fromMe={fromMe}
      profilePic={profilePic}
      actions={actions}
      rowProps={rowProps}
      bubble={
        <Box
          sx={{
            ...bubbleSx(fromMe, Boolean(image)),
            ...(beingEdited && { outline: "2px solid", outlineColor: "warning.main", outlineOffset: 2 }),
          }}
        >
          {image && (
            <MessageImage
              src={mediaUrl(image.thumbId)}
              srcSet={imageSrcSet(image)}
              placeholder={image.placeholder}
              width={image.width}
              height={image.height}
              alt={message.body}
              onClick={onOpenImage ? () => onOpenImage(message._id) : undefined}
            />
          )}
          {voice && <VoiceMessage voice={voice} fromMe={fromMe} />}
          {message.body && (
            <Box sx={image ? captionSx : undefined}>
              <LinkifiedText text={message.body} fromMe={fromMe} />
              {linkPreview && <LinkPreviewCard preview={linkPreview} fromMe={fromMe} />}
            </Box>
          )}
        </Box>
      }
      footer={
        <Time value={message.createdAt}>
          {message.editedAt && (
            <Box component="span" sx={{ textTransform: "none", ml: 0.5 }}>
              · edited
            </Box>
          )}
        </Time>
      }
    />
  );
};

// Takes everything it needs as props instead of subscribing to the store, and
// is memoised, so a new message or an unread-count change no longer
// re-renders every bubble in the conversation.
const Message = ({ message, fromMe, profilePic, peer, onOpenImage }) =>
  message.call ? (
    <CallHistoryMessage message={message} fromMe={fromMe} peer={peer} />
  ) : (
    <ChatMessage message={message} fromMe={fromMe} profilePic={profilePic} onOpenImage={onOpenImage} />
  );

// Optimistic bubble for an image that is still uploading, or failed to.
export const PendingImageMessage = ({ pending, profilePic, onRetry, onDiscard }) => {
  const failed = pending.status === "failed";
  // At 100% the bytes are up but the server is still processing them.
  const processing = !failed && pending.progress >= 1;

  const overlay = (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "rgba(0,0,0,0.45)",
        color: "white",
      }}
    >
      {failed ? (
        <ErrorOutlineOutlined aria-hidden sx={{ fontSize: 30 }} />
      ) : (
        <CircularProgress
          color="inherit"
          size={40}
          variant={processing ? "indeterminate" : "determinate"}
          value={Math.round(pending.progress * 100)}
          aria-label="Uploading image"
        />
      )}
    </Box>
  );

  return (
    <MessageRow
      fromMe
      profilePic={profilePic}
      bubble={
        <Box sx={{ ...bubbleSx(true, true), opacity: failed ? 0.85 : 1 }}>
          <MessageImage
            src={pending.previewUrl}
            width={pending.width}
            height={pending.height}
            alt={pending.caption}
            overlay={overlay}
          />
          {pending.caption && <Box sx={captionSx}>{pending.caption}</Box>}
        </Box>
      }
      footer={
        failed ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }} role="alert">
            <Typography variant="caption" sx={{ color: "error.light", fontWeight: 500 }}>
              Not sent
            </Typography>
            <Button size="small" onClick={() => onRetry(pending)} sx={{ minWidth: 0, px: 1, py: 0.25 }}>
              Retry
            </Button>
            <Button
              size="small"
              color="inherit"
              onClick={() => onDiscard(pending.tempId)}
              sx={{ minWidth: 0, px: 1, py: 0.25, color: "text.secondary", background: "none" }}
            >
              Discard
            </Button>
          </Box>
        ) : (
          <Typography variant="caption" sx={footerSx}>
            {processing ? "Processing…" : `Sending ${Math.round(pending.progress * 100)}%`}
          </Typography>
        )
      }
    />
  );
};

export default memo(Message);

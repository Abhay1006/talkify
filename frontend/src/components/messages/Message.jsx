import { useAuthContext } from "../../context/AuthContext";
import { extractTime } from "../../utils/extractTime";
import useConversation from "../../zustand/useConversations.js";
import { mediaUrl } from "../../utils/prepareImage";
import { imageSrcSet } from "../../utils/messageImage";
import MessageImage from "./MessageImage";
import { Box, Typography, Avatar, Button, CircularProgress } from "@mui/material";
import { FiAlertCircle } from "react-icons/fi";

const bubbleSx = (fromMe, hasImage) => ({
  ...(hasImage
    ? { p: 0.5 }
    : { px: { xs: 2, sm: 2.5 }, py: { xs: 1, sm: 1.5 } }),
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
});

const captionSx = { px: { xs: 1.5, sm: 2 }, pt: 0.75, pb: 0.5 };

const MessageRow = ({ fromMe, profilePic, bubble, footer }) => (
  <Box sx={{ display: 'flex', width: '100%', mb: { xs: 1.5, sm: 3 }, justifyContent: fromMe ? 'flex-end' : 'flex-start' }}>
    <Box sx={{ display: 'flex', maxWidth: { xs: '85%', sm: '80%' }, flexDirection: fromMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: { xs: 0.5, sm: 1 } }}>

      {/* Avatar — hidden on mobile for cleaner look */}
      <Box sx={{ flexShrink: 0, mb: 0.5, display: { xs: 'none', sm: 'block' } }}>
        <Avatar src={profilePic} variant="rounded" sx={{ width: 32, height: 32, border: '1px solid rgba(255,255,255,0.1)' }} />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: fromMe ? 'flex-end' : 'flex-start', minWidth: 0 }}>
        {bubble}
        {footer}
      </Box>
    </Box>
  </Box>
);

const footerSx = { mt: 0.5, px: 0.5, color: 'text.secondary', fontSize: { xs: '0.55rem', sm: '0.625rem' }, fontWeight: 500, textTransform: 'uppercase' };

const Message = ({ message, onOpenImage }) => {
  const { authUser } = useAuthContext();
  const { selectedConversation } = useConversation();
  const fromMe = message.senderId === authUser._id;
  const formattedTime = extractTime(message.createdAt);
  const { image } = message;

  const profilePic = fromMe
    ? authUser.profilePic
    : selectedConversation?.profilePic;

  return (
    <MessageRow
      fromMe={fromMe}
      profilePic={profilePic}
      bubble={
        <Box sx={bubbleSx(fromMe, !!image)}>
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
          {message.body && <Box sx={image ? captionSx : undefined}>{message.body}</Box>}
        </Box>
      }
      footer={
        <Typography variant="caption" sx={footerSx}>
          {formattedTime}
        </Typography>
      }
    />
  );
};

// Optimistic bubble for an image that is still uploading, or failed to.
export const PendingImageMessage = ({ pending, onRetry, onDiscard }) => {
  const { authUser } = useAuthContext();
  const failed = pending.status === 'failed';
  // At 100% the bytes are up but the server is still processing them.
  const processing = !failed && pending.progress >= 1;

  const overlay = (
    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.45)', color: 'white' }}>
      {failed ? (
        <FiAlertCircle size={28} aria-hidden />
      ) : (
        <CircularProgress
          color="inherit"
          size={40}
          variant={processing ? 'indeterminate' : 'determinate'}
          value={Math.round(pending.progress * 100)}
          aria-label="Uploading image"
        />
      )}
    </Box>
  );

  return (
    <MessageRow
      fromMe
      profilePic={authUser.profilePic}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }} role="alert">
            <Typography variant="caption" sx={{ color: 'error.light', fontWeight: 500 }}>
              Not sent
            </Typography>
            <Button size="small" onClick={() => onRetry(pending)} sx={{ minWidth: 0, px: 1, py: 0.25 }}>Retry</Button>
            <Button size="small" color="inherit" onClick={() => onDiscard(pending.tempId)} sx={{ minWidth: 0, px: 1, py: 0.25, color: 'text.secondary', background: 'none' }}>Discard</Button>
          </Box>
        ) : (
          <Typography variant="caption" sx={footerSx}>
            {processing ? 'Processing…' : `Sending ${Math.round(pending.progress * 100)}%`}
          </Typography>
        )
      }
    />
  );
};

export default Message;

import { useState, useRef, useEffect } from "react";
import { FiSend, FiPlusCircle, FiSmile, FiX } from "react-icons/fi";
import useSendMessage from "../../hooks/useSendMessages.js";
import useSendImage from "../../hooks/useSendImage.js";
import useImageDraft from "../../hooks/useImageDraft.js";
import useConversation from "../../zustand/useConversations.js";
import { ACCEPTED_IMAGE_TYPES, formatBytes } from "../../utils/prepareImage.js";
import { Box, TextField, IconButton, CircularProgress, InputAdornment, Typography } from "@mui/material";

const ImageDraftTray = ({ draft, onRemove }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, p: 1, borderRadius: 3, bgcolor: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
    <Box sx={{ position: 'relative', width: 56, height: 56, flexShrink: 0, borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {draft.status === 'ready' ? (
        <Box component="img" src={draft.previewUrl} alt="Selected image" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <CircularProgress size={20} aria-label="Preparing image" />
      )}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" fontWeight={600} sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
        {draft.status === 'ready' ? 'Image ready' : 'Preparing image…'}
      </Typography>
      {draft.status === 'ready' && (
        <Typography variant="caption" color="text.secondary">
          {draft.width} × {draft.height} · {formatBytes(draft.blob.size)}
        </Typography>
      )}
    </Box>
    <IconButton onClick={onRemove} aria-label="Remove image" sx={{ color: 'text.secondary', minWidth: 40, minHeight: 40 }}>
      <FiX size={18} />
    </IconButton>
  </Box>
);

const MessageInput = () => {
  const [message, setMessage] = useState("");
  const { loading, sendMessage } = useSendMessage();
  const { sendImage } = useSendImage();
  const { imageDraft, pickImage, clearImage } = useImageDraft();
  const { selectedConversation, takeImageDraft } = useConversation();
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (selectedConversation && inputRef.current) {
      // Small delay to prevent keyboard from opening on page load on mobile
      const timer = setTimeout(() => {
        inputRef.current.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedConversation]);

  // A picked image belongs to the chat it was picked in.
  useEffect(() => clearImage, [selectedConversation?._id, clearImage]);

  const imageReady = imageDraft?.status === 'ready';
  const canSend = imageReady || (!imageDraft && !!message.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSend) return;

    if (imageReady) {
      sendImage(selectedConversation._id, takeImageDraft(), message.trim());
      setMessage("");
    } else {
      await sendMessage(message);
      setMessage("");
    }
    // Re-focus input after sending on mobile
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleFileChange = (e) => {
    pickImage(e.target.files?.[0]);
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
  };

  const handlePaste = (e) => {
    const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      pickImage(file);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ position: 'relative' }}>
      {imageDraft && <ImageDraftTray draft={imageDraft} onRemove={clearImage} />}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        onChange={handleFileChange}
        hidden
      />
      <TextField
        inputRef={inputRef}
        fullWidth
        variant="outlined"
        placeholder={imageDraft ? "Add a caption..." : "Type a message..."}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onPaste={handlePaste}
        size="small"
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.03)',
          borderRadius: { xs: 3, sm: 4 },
          '& fieldset': { border: 'none' },
          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' },
          '&.Mui-focused': { bgcolor: 'rgba(255, 255, 255, 0.05)' },
          '& .MuiInputBase-input': {
            py: { xs: 1.2, sm: 1.5 },
            fontSize: { xs: '0.875rem', sm: '1rem' },
          },
        }}
        slotProps={{ input: {
          startAdornment: (
            <InputAdornment position="start">
              <IconButton
                size="small"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach image"
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' }, minWidth: 40, minHeight: 40 }}
              >
                <FiPlusCircle size={20} />
              </IconButton>
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {/* Hide emoji button on very small screens */}
              <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'warning.main' }, mr: { xs: 0.5, sm: 1 }, display: { xs: 'none', sm: 'inline-flex' }, minWidth: 40, minHeight: 40 }}>
                <FiSmile size={20} />
              </IconButton>
              <IconButton
                type="submit"
                disabled={loading || !canSend}
                aria-label={imageReady ? "Send image" : "Send message"}
                sx={{
                  bgcolor: canSend ? 'primary.main' : 'rgba(255, 255, 255, 0.05)',
                  color: canSend ? 'white' : 'text.secondary',
                  borderRadius: 2,
                  width: { xs: 38, sm: 40 },
                  height: { xs: 38, sm: 40 },
                  minWidth: 38,
                  minHeight: 38,
                  '&:hover': { bgcolor: canSend ? 'primary.dark' : 'rgba(255, 255, 255, 0.05)' },
                  '&.Mui-disabled': { bgcolor: 'rgba(255, 255, 255, 0.05)', color: 'text.disabled' }
                }}
              >
                {loading ? <CircularProgress size={18} color="inherit" /> : <FiSend size={16} />}
              </IconButton>
            </InputAdornment>
          ),
        } }}
      />
    </Box>
  );
};
export default MessageInput;

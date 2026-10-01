import { useState, useRef, useEffect } from "react";
import { Box, TextField, IconButton, CircularProgress, InputAdornment } from "@mui/material";
import { Send } from "@mui/icons-material";
import useSendMessage from "../../hooks/useSendMessages.js";

// Mirrors MAX_MESSAGE_LENGTH in backend/controllers/message.controller.js.
const MAX_MESSAGE_LENGTH = 4000;

const MessageInput = ({ receiverId }) => {
  const [message, setMessage] = useState("");
  const { loading, sendMessage } = useSendMessage(receiverId);
  const inputRef = useRef(null);
  const canSend = message.trim().length > 0 && !loading;

  useEffect(() => {
    // Small delay to prevent keyboard from opening on page load on mobile
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, [receiverId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Enter submits the form directly, so this check — not just the disabled
    // button — is what stops whitespace-only messages and double sends.
    if (!canSend) return;

    const sent = await sendMessage(message);
    // Keep the text on failure so the user can retry without retyping.
    if (sent) setMessage("");
    inputRef.current?.focus();
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ position: 'relative' }}>
      <TextField
        inputRef={inputRef}
        fullWidth
        variant="outlined"
        placeholder="Type a message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
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
        // MUI v9 ignores the old InputProps/inputProps props; slotProps is the
        // only way these reach the input.
        slotProps={{
          htmlInput: { maxLength: MAX_MESSAGE_LENGTH, 'aria-label': 'Message' },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  type="submit"
                  aria-label="Send message"
                  disabled={!canSend}
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
                  {loading ? <CircularProgress size={18} color="inherit" /> : <Send sx={{ fontSize: 18 }} />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
};
export default MessageInput;

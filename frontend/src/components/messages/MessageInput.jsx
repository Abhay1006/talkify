import { useState, useRef, useEffect } from "react";
import { FiSend, FiPlusCircle, FiSmile } from "react-icons/fi";
import useSendMessage from "../../hooks/useSendMessages.js";
import useConversation from "../../zustand/useConversations.js";
import { Box, TextField, IconButton, CircularProgress, InputAdornment } from "@mui/material";

const MessageInput = () => {
  const [message, setMessage] = useState("");
  const { loading, sendMessage } = useSendMessage();
  const { selectedConversation } = useConversation();
  const inputRef = useRef(null);

  useEffect(() => {
    if (selectedConversation && inputRef.current) {
      // Small delay to prevent keyboard from opening on page load on mobile
      const timer = setTimeout(() => {
        inputRef.current.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedConversation]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message) return;
    await sendMessage(message);
    setMessage("");
    // Re-focus input after sending on mobile
    if (inputRef.current) {
      inputRef.current.focus();
    }
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
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' }, minWidth: 40, minHeight: 40 }}>
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
                disabled={loading || !message.trim()}
                sx={{ 
                  bgcolor: message.trim() ? 'primary.main' : 'rgba(255, 255, 255, 0.05)',
                  color: message.trim() ? 'white' : 'text.secondary',
                  borderRadius: 2,
                  width: { xs: 38, sm: 40 },
                  height: { xs: 38, sm: 40 },
                  minWidth: 38,
                  minHeight: 38,
                  '&:hover': { bgcolor: message.trim() ? 'primary.dark' : 'rgba(255, 255, 255, 0.05)' },
                  '&.Mui-disabled': { bgcolor: 'rgba(255, 255, 255, 0.05)', color: 'text.disabled' }
                }}
              >
                {loading ? <CircularProgress size={18} color="inherit" /> : <FiSend size={16} />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </Box>
  );
};
export default MessageInput;

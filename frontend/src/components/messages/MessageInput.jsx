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
      inputRef.current.focus();
    }
  }, [selectedConversation]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message) return;
    await sendMessage(message);
    setMessage("");
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
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.03)',
          borderRadius: 4,
          '& fieldset': { border: 'none' },
          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' },
          '&.Mui-focused': { bgcolor: 'rgba(255, 255, 255, 0.05)' },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                <FiPlusCircle size={22} />
              </IconButton>
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'warning.main' }, mr: 1 }}>
                <FiSmile size={22} />
              </IconButton>
              <IconButton 
                type="submit"
                disabled={loading || !message.trim()}
                sx={{ 
                  bgcolor: message.trim() ? 'primary.main' : 'rgba(255, 255, 255, 0.05)',
                  color: message.trim() ? 'white' : 'text.secondary',
                  borderRadius: 2,
                  width: 40,
                  height: 40,
                  '&:hover': { bgcolor: message.trim() ? 'primary.dark' : 'rgba(255, 255, 255, 0.05)' },
                  '&.Mui-disabled': { bgcolor: 'rgba(255, 255, 255, 0.05)', color: 'text.disabled' }
                }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : <FiSend size={18} />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </Box>
  );
};
export default MessageInput;

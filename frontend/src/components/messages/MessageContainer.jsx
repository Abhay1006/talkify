import { useEffect, useState } from "react";
import useConversation from "../../zustand/useConversations.js";
import MessageInput from "./MessageInput";
import Messages from "./Messages";
import { FiMessageSquare, FiShield, FiArrowLeft } from "react-icons/fi";
import { useAuthContext } from "../../context/AuthContext";
import { Box, Typography, Avatar, Button, CircularProgress, IconButton } from "@mui/material";
import { apiClient } from "../../api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

const MessageContainer = () => {
  const { selectedConversation, setSelectedConversation } = useConversation();
  const { authUser } = useAuthContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => setSelectedConversation(null);
  }, [setSelectedConversation]);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await apiClient.put(`/api/chat-requests/${selectedConversation.requestId}/accept`);
      setSelectedConversation({ ...selectedConversation, requestStatus: 'accepted' });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      enqueueSnackbar('Request accepted!', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Failed to accept request', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async () => {
    setLoading(true);
    try {
      await apiClient.post(`/api/block/${selectedConversation._id}`);
      setSelectedConversation(null);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      enqueueSnackbar('User blocked', { variant: 'info' });
    } catch (error) {
      enqueueSnackbar('Failed to block user', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const isPendingReceiver = selectedConversation?.requestStatus === 'pending' && selectedConversation?.requestSenderId !== authUser._id;
  const isPendingSender = selectedConversation?.requestStatus === 'pending' && selectedConversation?.requestSenderId === authUser._id;

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'rgba(255, 255, 255, 0.01)', minWidth: 0 }}>
      {!selectedConversation ? (
        <NoChatSelected />
      ) : (
        <>
          {/* Chat Header */}
          <Box sx={{ 
            px: { xs: 1.5, sm: 4 }, py: { xs: 1.5, sm: 2 }, 
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            bgcolor: 'rgba(255, 255, 255, 0.02)',
            backdropFilter: 'blur(4px)',
            flexShrink: 0,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, minWidth: 0 }}>
              <IconButton
                onClick={() => setSelectedConversation(null)}
                sx={{
                  display: { xs: 'inline-flex', md: 'none' },
                  color: 'text.primary',
                  p: 1,
                  mr: 0,
                  minWidth: 44,
                  minHeight: 44,
                }}
              >
                <FiArrowLeft size={22} />
              </IconButton>
              <Avatar src={selectedConversation.profilePic} variant="rounded" sx={{ width: { xs: 36, sm: 40 }, height: { xs: 36, sm: 40 }, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={600} color="text.primary" lineHeight={1.2} noWrap sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                  {selectedConversation.fullName}
                </Typography>
                <Typography variant="caption" color="success.main" fontWeight={500} sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                  Online
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Messages Area */}
          <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
            <Messages />
          </Box>

          {/* Input Area */}
          <Box className="chat-input-area" sx={{
            p: { xs: 1.5, sm: 3 },
            pb: { xs: 'calc(env(safe-area-inset-bottom, 4px) + 8px)', sm: 3 },
            flexShrink: 0,
          }}>
            {isPendingReceiver ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center', p: { xs: 2, sm: 3 }, bgcolor: 'rgba(108, 99, 255, 0.1)', borderRadius: { xs: 3, sm: 4 }, border: '1px solid rgba(108, 99, 255, 0.2)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                  <FiShield size={18} />
                  <Typography variant="body2" fontWeight={600} sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Message Request</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                  {selectedConversation.fullName} wants to chat with you. Accept to reply.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Button variant="contained" color="success" onClick={handleAccept} disabled={loading} sx={{ minWidth: { xs: 80, sm: 100 }, minHeight: 44 }}>
                    {loading ? <CircularProgress size={20} color="inherit" /> : 'Accept'}
                  </Button>
                  <Button variant="contained" color="error" onClick={handleBlock} disabled={loading} sx={{ minWidth: { xs: 80, sm: 100 }, minHeight: 44 }}>
                    {loading ? <CircularProgress size={20} color="inherit" /> : 'Block'}
                  </Button>
                </Box>
              </Box>
            ) : isPendingSender ? (
              <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(255, 255, 255, 0.05)', borderRadius: { xs: 3, sm: 4 }, border: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Waiting for {selectedConversation.fullName} to accept your request...</Typography>
              </Box>
            ) : (
              <MessageInput />
            )}
          </Box>
        </>
      )}
    </Box>
  );
};
export default MessageContainer;

const NoChatSelected = () => {
  const { authUser } = useAuthContext();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', bgcolor: 'rgba(255, 255, 255, 0.01)' }}>
      <Box sx={{ px: { xs: 3, sm: 2 }, textAlign: 'center', maxWidth: 400 }}>
        <Box sx={{ 
          width: { xs: 72, sm: 96 }, height: { xs: 72, sm: 96 }, 
          bgcolor: 'rgba(108, 99, 255, 0.1)', 
          border: '1px solid rgba(108, 99, 255, 0.2)', 
          borderRadius: { xs: 4, sm: 6 }, 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          mx: 'auto', mb: 3, 
          boxShadow: '0 10px 25px -5px rgba(108, 99, 255, 0.1)'
        }}>
          <FiMessageSquare size={32} color="#6C63FF" />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight="bold" color="text.primary" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
            Welcome, {authUser.fullName.split(' ')[0]}!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 300, lineHeight: 1.6, mb: 3, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
            Select a conversation from the sidebar to start messaging and sharing moments.
          </Typography>
        </Box>
        <Box sx={{ 
          display: 'inline-flex', alignItems: 'center', 
          px: 2, py: 1, 
          bgcolor: 'rgba(255,255,255,0.05)', 
          border: '1px solid rgba(255,255,255,0.1)', 
          borderRadius: 10, 
          fontSize: '0.75rem', fontWeight: 500, color: 'text.secondary' 
        }}>
          <Box sx={{ width: 8, height: 8, bgcolor: '#4ade80', borderRadius: '50%', mr: 1 }} />
          Talkify Secure Messaging
        </Box>
      </Box>
    </Box>
  );
};

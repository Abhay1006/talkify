import { useState, useRef, useEffect } from "react";
import { FiSend, FiPlusCircle, FiSmile, FiX, FiMic, FiTrash2, FiEdit2 } from "react-icons/fi";
import { useSnackbar } from "notistack";
import useVoiceRecorder, { RecorderError } from "../../hooks/useVoiceRecorder.js";
import { apiClient } from "../../api/client.js";
import { formatDuration } from "../../calls/callText.js";
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

const RecordingBar = ({ elapsedMs, level, sending, onCancel, onSend }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, borderRadius: { xs: 3, sm: 4 }, bgcolor: 'rgba(255,255,255,0.05)' }} role="group" aria-label="Recording voice message">
    <IconButton onClick={onCancel} disabled={sending} aria-label="Discard recording" sx={{ color: 'text.secondary', minWidth: 40, minHeight: 40 }}>
      <FiTrash2 size={18} />
    </IconButton>
    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#e5484d', animation: 'recBlink 1s infinite', '@keyframes recBlink': { '50%': { opacity: 0.3 } }, '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }} />
    <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 40 }}>{formatDuration(elapsedMs)}</Typography>
    {/* Live input level, so it's obvious the mic is picking you up. */}
    <Box sx={{ flex: 1, height: 6, borderRadius: '3px', bgcolor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <Box sx={{ height: '100%', width: `${Math.round(level * 100)}%`, bgcolor: 'primary.light', transition: 'width 80ms linear' }} />
    </Box>
    <IconButton
      onClick={onSend}
      disabled={sending}
      aria-label="Send voice message"
      sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: 2, width: 40, height: 40, '&:hover': { bgcolor: 'primary.dark' } }}
    >
      {sending ? <CircularProgress size={18} color="inherit" /> : <FiSend size={16} />}
    </IconButton>
  </Box>
);

const EditBar = ({ onCancel }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 1.5, py: 0.75, borderRadius: '12px', bgcolor: 'rgba(245,165,36,0.1)', border: '1px solid rgba(245,165,36,0.25)' }}>
    <FiEdit2 size={14} />
    <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>Editing message</Typography>
    <IconButton onClick={onCancel} aria-label="Cancel editing" size="small" sx={{ color: 'text.secondary' }}>
      <FiX size={16} />
    </IconButton>
  </Box>
);

const MessageInput = () => {
  const [message, setMessage] = useState("");
  const { loading, sendMessage } = useSendMessage();
  const { sendImage } = useSendImage();
  const { imageDraft, pickImage, clearImage } = useImageDraft();
  const { selectedConversation, takeImageDraft, editingMessage, setEditingMessage, updateMessage, appendMessage } = useConversation();
  const { enqueueSnackbar } = useSnackbar();
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const sendVoiceRef = useRef(null);
  const recorder = useVoiceRecorder({ onMaxDuration: () => sendVoiceRef.current?.() });

  useEffect(() => {
    if (selectedConversation && inputRef.current) {
      // Small delay to prevent keyboard from opening on page load on mobile
      const timer = setTimeout(() => {
        inputRef.current.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedConversation]);

  // A picked image, an edit or a recording belongs to the chat it started in.
  useEffect(() => clearImage, [selectedConversation?._id, clearImage]);
  useEffect(() => () => setEditingMessage(null), [selectedConversation?._id, setEditingMessage]);
  const { cancel: cancelRecording } = recorder;
  useEffect(() => cancelRecording, [selectedConversation?._id, cancelRecording]);

  // Starting an edit loads the text into the composer.
  useEffect(() => {
    if (!editingMessage) return;
    setMessage(editingMessage.body ?? "");
    clearImage();
    inputRef.current?.focus();
  }, [editingMessage, clearImage]);

  const cancelEdit = () => {
    setEditingMessage(null);
    setMessage("");
  };

  const imageReady = imageDraft?.status === 'ready';
  const canSend = imageReady || (!imageDraft && !!message.trim());
  // With nothing typed, the send button becomes a record button.
  const showMic = !editingMessage && !imageDraft && !message.trim();

  const startRecording = async () => {
    try {
      await recorder.start();
    } catch (error) {
      enqueueSnackbar(error instanceof RecorderError ? error.message : "Couldn't start recording", { variant: 'error' });
    }
  };

  const sendVoice = async () => {
    if (sendingVoice) return;
    const receiverId = selectedConversation._id;
    setSendingVoice(true);
    try {
      const recording = await recorder.stop();
      if (!recording || recording.durationMs < 500) {
        enqueueSnackbar('Too short to send. Record for at least half a second.', { variant: 'info' });
        return;
      }
      const form = new FormData();
      const ext = recording.blob.type.includes('mp4') ? 'm4a' : recording.blob.type.includes('ogg') ? 'ogg' : 'webm';
      form.append('audio', recording.blob, `voice.${ext}`);
      form.append('durationMs', String(recording.durationMs));
      form.append('waveform', JSON.stringify(recording.waveform));
      const sent = await apiClient.upload(`/api/messages/send/${receiverId}/voice`, form);
      if (useConversation.getState().selectedConversation?._id === receiverId) appendMessage(sent);
    } catch (error) {
      enqueueSnackbar(error.message || 'Voice message failed to send', { variant: 'error' });
    } finally {
      setSendingVoice(false);
    }
  };
  sendVoiceRef.current = sendVoice;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editingMessage) {
      if (!message.trim() || savingEdit) return;
      setSavingEdit(true);
      try {
        const updated = await apiClient.request('PATCH', `/api/messages/${editingMessage._id}`, { message });
        updateMessage(updated);
        cancelEdit();
      } catch (error) {
        enqueueSnackbar(error.message, { variant: 'error' });
      } finally {
        setSavingEdit(false);
      }
      return;
    }

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

  if (recorder.recording || sendingVoice) {
    return (
      <RecordingBar
        elapsedMs={recorder.elapsedMs}
        level={recorder.level}
        sending={sendingVoice}
        onCancel={recorder.cancel}
        onSend={sendVoice}
      />
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ position: 'relative' }}>
      {editingMessage && <EditBar onCancel={cancelEdit} />}
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
        placeholder={editingMessage ? "Edit message..." : imageDraft ? "Add a caption..." : "Type a message..."}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && editingMessage) cancelEdit();
        }}
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
              {showMic ? (
                <IconButton
                  onClick={startRecording}
                  aria-label="Record voice message"
                  sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', color: 'text.primary', borderRadius: 2, width: { xs: 38, sm: 40 }, height: { xs: 38, sm: 40 }, minWidth: 38, minHeight: 38, '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                >
                  <FiMic size={17} />
                </IconButton>
              ) : (
              <IconButton
                type="submit"
                disabled={loading || savingEdit || (editingMessage ? !message.trim() : !canSend)}
                aria-label={editingMessage ? "Save edit" : imageReady ? "Send image" : "Send message"}
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
                {loading || savingEdit ? <CircularProgress size={18} color="inherit" /> : <FiSend size={16} />}
              </IconButton>
              )}
            </InputAdornment>
          ),
        } }}
      />
    </Box>
  );
};
export default MessageInput;

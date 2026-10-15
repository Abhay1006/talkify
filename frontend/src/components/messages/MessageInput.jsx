import { useState, useRef, useEffect } from "react";
import { Box, TextField, IconButton, CircularProgress, InputAdornment, Typography } from "@mui/material";
import {
  Send,
  AddCircleOutlineOutlined,
  Close,
  MicNoneOutlined,
  DeleteOutlined,
  EditOutlined,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { useQueryClient } from "@tanstack/react-query";
import useSendMessage from "../../hooks/useSendMessages.js";
import useSendImage from "../../hooks/useSendImage.js";
import useImageDraft from "../../hooks/useImageDraft.js";
import useVoiceRecorder, { RecorderError } from "../../hooks/useVoiceRecorder.js";
import useConversation from "../../zustand/useConversations.js";
import { apiClient } from "../../api/client.js";
import { appendMessageToCache, updateMessageInCache } from "../../queries/messages.js";
import { conversationsQueryKey } from "../../queries/conversations.js";
import { ACCEPTED_IMAGE_TYPES, formatBytes } from "../../utils/prepareImage.js";
import { formatDuration } from "../../calls/callText.js";

// Mirrors MAX_MESSAGE_LENGTH in backend/controllers/message.controller.js.
const MAX_MESSAGE_LENGTH = 4000;

const roundButtonSx = {
  borderRadius: 2,
  width: { xs: 38, sm: 40 },
  height: { xs: 38, sm: 40 },
  minWidth: 38,
  minHeight: 38,
};

const ImageDraftTray = ({ draft, onRemove }) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      mb: 1,
      p: 1,
      borderRadius: "14px",
      bgcolor: "rgba(255, 255, 255, 0.04)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}
  >
    <Box
      sx={{
        position: "relative",
        width: 56,
        height: 56,
        flexShrink: 0,
        borderRadius: "10px",
        overflow: "hidden",
        bgcolor: "rgba(255,255,255,0.05)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {draft.status === "ready" ? (
        <Box
          component="img"
          src={draft.previewUrl}
          alt="Selected image"
          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <CircularProgress size={20} aria-label="Preparing image" />
      )}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" fontWeight={600} sx={{ fontSize: { xs: "0.8rem", sm: "0.875rem" } }}>
        {draft.status === "ready" ? "Image ready" : "Preparing image…"}
      </Typography>
      {draft.status === "ready" && (
        <Typography variant="caption" color="text.secondary">
          {draft.width} × {draft.height} · {formatBytes(draft.blob.size)}
        </Typography>
      )}
    </Box>
    <IconButton
      onClick={onRemove}
      aria-label="Remove image"
      sx={{ color: "text.secondary", minWidth: 40, minHeight: 40 }}
    >
      <Close sx={{ fontSize: 20 }} />
    </IconButton>
  </Box>
);

const RecordingBar = ({ elapsedMs, level, sending, onCancel, onSend }) => (
  <Box
    role="group"
    aria-label="Recording voice message"
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1,
      px: 1,
      py: 0.75,
      borderRadius: { xs: 3, sm: 4 },
      bgcolor: "rgba(255,255,255,0.05)",
    }}
  >
    <IconButton
      onClick={onCancel}
      disabled={sending}
      aria-label="Discard recording"
      sx={{ color: "text.secondary", minWidth: 40, minHeight: 40 }}
    >
      <DeleteOutlined sx={{ fontSize: 20 }} />
    </IconButton>
    <Box
      sx={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        bgcolor: "#e5484d",
        animation: "recBlink 1s infinite",
        "@keyframes recBlink": { "50%": { opacity: 0.3 } },
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}
    />
    <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", minWidth: 40 }}>
      {formatDuration(elapsedMs)}
    </Typography>
    {/* Live input level, so it's obvious the mic is picking you up. */}
    <Box
      sx={{ flex: 1, height: 6, borderRadius: "3px", bgcolor: "rgba(255,255,255,0.08)", overflow: "hidden" }}
    >
      <Box
        sx={{
          height: "100%",
          width: `${Math.round(level * 100)}%`,
          bgcolor: "primary.light",
          transition: "width 80ms linear",
        }}
      />
    </Box>
    <IconButton
      onClick={onSend}
      disabled={sending}
      aria-label="Send voice message"
      sx={{
        ...roundButtonSx,
        bgcolor: "primary.main",
        color: "white",
        "&:hover": { bgcolor: "primary.dark" },
      }}
    >
      {sending ? <CircularProgress size={18} color="inherit" /> : <Send sx={{ fontSize: 18 }} />}
    </IconButton>
  </Box>
);

const EditBar = ({ onCancel }) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1,
      mb: 1,
      px: 1.5,
      py: 0.75,
      borderRadius: "12px",
      bgcolor: "rgba(245,165,36,0.1)",
      border: "1px solid rgba(245,165,36,0.25)",
    }}
  >
    <EditOutlined sx={{ fontSize: 16 }} />
    <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
      Editing message
    </Typography>
    <IconButton onClick={onCancel} aria-label="Cancel editing" size="small" sx={{ color: "text.secondary" }}>
      <Close sx={{ fontSize: 18 }} />
    </IconButton>
  </Box>
);

// Remounted per conversation (keyed by MessageContainer), so drafts, edits and
// recordings never leak from one chat into another.
const MessageInput = ({ receiverId }) => {
  const [message, setMessage] = useState("");
  const { loading, sendMessage } = useSendMessage(receiverId);
  const { sendImage } = useSendImage();
  const { imageDraft, pickImage, clearImage } = useImageDraft();
  const takeImageDraft = useConversation((state) => state.takeImageDraft);
  const editingMessage = useConversation((state) => state.editingMessage);
  const setEditingMessage = useConversation((state) => state.setEditingMessage);
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const sendVoiceRef = useRef(null);
  const recorder = useVoiceRecorder({ onMaxDuration: () => sendVoiceRef.current?.() });

  useEffect(() => {
    // Small delay to prevent keyboard from opening on page load on mobile
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, [receiverId]);

  // Leaving the chat drops any half-finished image or edit.
  useEffect(
    () => () => {
      clearImage();
      setEditingMessage(null);
    },
    [clearImage, setEditingMessage]
  );

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

  const imageReady = imageDraft?.status === "ready";
  const hasText = message.trim().length > 0;
  const canSend = !loading && (imageReady || (!imageDraft && hasText));
  // With nothing typed, the send button becomes a record button.
  const showMic = !editingMessage && !imageDraft && !hasText;

  const startRecording = async () => {
    try {
      await recorder.start();
    } catch (error) {
      enqueueSnackbar(error instanceof RecorderError ? error.message : "Couldn't start recording", {
        variant: "error",
      });
    }
  };

  const sendVoice = async () => {
    if (sendingVoice) return;
    setSendingVoice(true);
    try {
      const recording = await recorder.stop();
      if (!recording || recording.durationMs < 500) {
        enqueueSnackbar("Too short to send. Record for at least half a second.", { variant: "info" });
        return;
      }
      const form = new FormData();
      const type = recording.blob.type;
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      form.append("audio", recording.blob, `voice.${ext}`);
      form.append("durationMs", String(recording.durationMs));
      form.append("waveform", JSON.stringify(recording.waveform));
      const sent = await apiClient.upload(`/api/messages/send/${encodeURIComponent(receiverId)}/voice`, form);
      appendMessageToCache(queryClient, receiverId, sent);
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    } catch (error) {
      enqueueSnackbar(error.message || "Voice message failed to send", { variant: "error" });
    } finally {
      setSendingVoice(false);
    }
  };
  sendVoiceRef.current = sendVoice;

  const saveEdit = async () => {
    if (!hasText || savingEdit) return;
    setSavingEdit(true);
    try {
      const updated = await apiClient.patch(`/api/messages/${editingMessage._id}`, { message });
      updateMessageInCache(queryClient, receiverId, updated);
      cancelEdit();
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingMessage) return saveEdit();

    // Enter submits the form directly, so this check — not just the disabled
    // button — is what stops whitespace-only messages and double sends.
    if (!canSend) return;

    if (imageReady) {
      sendImage(receiverId, takeImageDraft(), message.trim());
      setMessage("");
    } else {
      const sent = await sendMessage(message);
      // Keep the text on failure so the user can retry without retyping.
      if (sent) setMessage("");
    }
    inputRef.current?.focus();
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

  const submitDisabled = editingMessage ? !hasText || savingEdit : !canSend;

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ position: "relative" }}>
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
        placeholder={
          editingMessage ? "Edit message..." : imageDraft ? "Add a caption..." : "Type a message..."
        }
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={(e) => {
          if (e.key === "Escape" && editingMessage) cancelEdit();
        }}
        size="small"
        sx={{
          bgcolor: "rgba(255, 255, 255, 0.03)",
          borderRadius: { xs: 3, sm: 4 },
          "& fieldset": { border: "none" },
          "&:hover": { bgcolor: "rgba(255, 255, 255, 0.05)" },
          "&.Mui-focused": { bgcolor: "rgba(255, 255, 255, 0.05)" },
          "& .MuiInputBase-input": {
            py: { xs: 1.2, sm: 1.5 },
            fontSize: { xs: "0.875rem", sm: "1rem" },
          },
        }}
        // MUI v9 ignores the old InputProps/inputProps props; slotProps is the
        // only way these reach the input.
        slotProps={{
          htmlInput: { maxLength: MAX_MESSAGE_LENGTH, "aria-label": "Message" },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <IconButton
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach image"
                  sx={{
                    color: "text.secondary",
                    "&:hover": { color: "primary.main" },
                    minWidth: 40,
                    minHeight: 40,
                  }}
                >
                  <AddCircleOutlineOutlined sx={{ fontSize: 22 }} />
                </IconButton>
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {showMic ? (
                  <IconButton
                    onClick={startRecording}
                    aria-label="Record voice message"
                    sx={{
                      ...roundButtonSx,
                      bgcolor: "rgba(255, 255, 255, 0.05)",
                      color: "text.primary",
                      "&:hover": { bgcolor: "primary.main", color: "white" },
                    }}
                  >
                    <MicNoneOutlined sx={{ fontSize: 20 }} />
                  </IconButton>
                ) : (
                  <IconButton
                    type="submit"
                    aria-label={editingMessage ? "Save edit" : imageReady ? "Send image" : "Send message"}
                    disabled={submitDisabled}
                    sx={{
                      ...roundButtonSx,
                      bgcolor: submitDisabled ? "rgba(255, 255, 255, 0.05)" : "primary.main",
                      color: submitDisabled ? "text.secondary" : "white",
                      "&:hover": { bgcolor: submitDisabled ? "rgba(255, 255, 255, 0.05)" : "primary.dark" },
                      "&.Mui-disabled": { bgcolor: "rgba(255, 255, 255, 0.05)", color: "text.disabled" },
                    }}
                  >
                    {loading || savingEdit ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      <Send sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                )}
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
};
export default MessageInput;

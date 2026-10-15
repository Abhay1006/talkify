import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../context/ToastContext";
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

const ImageDraftTray = ({ draft, onRemove }) => (
  <div className="compose-tray">
    {draft.status === "ready" ? (
      <img className="compose-thumb" src={draft.previewUrl} alt="Selected image" />
    ) : (
      <span className="compose-thumb" />
    )}
    <span className="compose-tray-text">
      {draft.status === "ready" ? (
        <>
          Image ready{" "}
          <span className="text-faint">
            {draft.width} × {draft.height} · {formatBytes(draft.blob.size)}
          </span>
        </>
      ) : (
        "Preparing image…"
      )}
    </span>
    <button type="button" className="btn-link" onClick={onRemove}>
      remove
    </button>
  </div>
);

const RecordingBar = ({ elapsedMs, level, sending, onCancel, onSend }) => (
  <div className="chat-compose" role="group" aria-label="Recording voice message">
    <button type="button" className="btn" onClick={onCancel} disabled={sending}>
      Discard
    </button>
    <span className="rec-dot" aria-hidden="true" />
    <span className="rec-time">{formatDuration(elapsedMs)}</span>
    {/* Live input level, so it's obvious the mic is picking you up. */}
    <span className="rec-meter" aria-hidden="true">
      <span className="rec-level" style={{ width: `${Math.round(level * 100)}%` }} />
    </span>
    <button type="button" className="btn btn-primary" onClick={onSend} disabled={sending}>
      {sending ? "Sending…" : "Send"}
    </button>
  </div>
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
  const { toast } = useToast();
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const sendVoiceRef = useRef(null);
  const recorder = useVoiceRecorder({ onMaxDuration: () => sendVoiceRef.current?.() });

  useEffect(() => {
    // Focus only where a keyboard is actually attached; on touch devices this
    // would slam the on-screen keyboard open on every conversation switch.
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
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
      toast(error instanceof RecorderError ? error.message : "Couldn't start recording", "error");
    }
  };

  const sendVoice = async () => {
    if (sendingVoice) return;
    setSendingVoice(true);
    try {
      const recording = await recorder.stop();
      if (!recording || recording.durationMs < 500) {
        toast("Too short to send. Record for at least half a second.", "info");
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
      toast(error.message || "Voice message failed to send", "error");
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
      toast(error.message, "error");
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
  const busy = loading || savingEdit;

  return (
    <div className="compose">
      {editingMessage && (
        <div className="compose-tray">
          <span className="compose-tray-text">Editing message</span>
          <button type="button" className="btn-link" onClick={cancelEdit}>
            cancel
          </button>
        </div>
      )}
      {imageDraft && <ImageDraftTray draft={imageDraft} onRemove={clearImage} />}
      <form className="chat-compose" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          onChange={handleFileChange}
          hidden
        />
        <button
          type="button"
          className="btn compose-attach"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach image"
          title="Attach image"
        >
          +
        </button>
        <input
          ref={inputRef}
          className="input"
          type="text"
          placeholder={editingMessage ? "Edit message" : imageDraft ? "Add a caption" : "Type a message"}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === "Escape" && editingMessage) {
              e.stopPropagation();
              cancelEdit();
            }
          }}
          maxLength={MAX_MESSAGE_LENGTH}
          aria-label="Message"
          autoComplete="off"
        />
        {showMic ? (
          <button type="button" className="btn" onClick={startRecording} aria-label="Record voice message">
            Mic
          </button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={submitDisabled}>
            {busy ? "…" : editingMessage ? "Save" : "Send"}
          </button>
        )}
      </form>
    </div>
  );
};

export default MessageInput;

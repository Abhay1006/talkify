import { memo, useRef } from "react";
import { useToast } from "../../context/ToastContext";
import { formatMessageTime } from "../../utils/formatMessageTime";
import { mediaUrl } from "../../utils/prepareImage";
import { imageSrcSet } from "../../utils/messageImage";
import { historyLabel } from "../../calls/callText";
import { startCall } from "../../calls/callEngine";
import { useCallStore } from "../../calls/callStore";
import useConversation from "../../zustand/useConversations.js";
import Menu from "../ui/Menu";
import MessageImage from "./MessageImage";
import { LinkifiedText, LinkPreviewCard } from "./MessageText";
import VoiceMessage from "./VoiceMessage";

// Mirrors EDIT_WINDOW_MS in backend/controllers/message.controller.js.
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const LONG_PRESS_MS = 500;

const Time = ({ value }) => {
  const createdAt = new Date(value);
  return (
    <time
      className="msg-time"
      dateTime={Number.isNaN(createdAt.getTime()) ? undefined : createdAt.toISOString()}
    >
      {formatMessageTime(value)}
    </time>
  );
};

// Copy / Edit. Opens from the ⋯ button (shown on hover), a right-click or a
// long press.
const MessageMenu = ({ message, fromMe, menuRef }) => {
  const setEditingMessage = useConversation((state) => state.setEditingMessage);
  const { toast } = useToast();

  const canEdit =
    fromMe &&
    !message.voice &&
    !message.call &&
    Date.now() - new Date(message.createdAt).getTime() < EDIT_WINDOW_MS;
  const canCopy = Boolean(message.body);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.body);
      toast("Copied", "success");
    } catch {
      toast("Couldn't copy", "warning");
    }
  };

  return (
    <Menu
      menuRef={menuRef}
      label="Message options"
      triggerClassName="msg-menu"
      items={[
        canCopy && { label: "Copy text", onSelect: copy },
        canEdit && { label: "Edit", onSelect: () => setEditingMessage(message) },
      ]}
    />
  );
};

// "Voice call · 2:31", "Missed video call": a system line with a one-tap
// call back.
const CallHistoryMessage = ({ message, fromMe, peer }) => {
  const busy = useCallStore(
    (st) => Boolean(st.call) && !["ended", "failed", "error"].includes(st.call.phase)
  );
  const { call } = message;
  const missed = call.status !== "completed" && !fromMe;

  return (
    <div className="msg-system">
      <span className={missed ? "is-missed" : undefined}>{historyLabel(call, fromMe)}</span>
      <Time value={message.createdAt} />
      <button
        type="button"
        className="btn-link"
        disabled={busy || !peer}
        onClick={() =>
          startCall(
            { _id: peer._id, fullName: peer.fullName, username: peer.username, profilePic: peer.profilePic },
            call.kind
          )
        }
      >
        call back
      </button>
    </div>
  );
};

const ChatMessage = ({ message, fromMe, grouped, peer, onOpenImage }) => {
  const beingEdited = useConversation((state) => state.editingMessage?._id === message._id);
  const menuRef = useRef(null);
  const pressTimer = useRef(null);
  const { image, voice, linkPreview } = message;

  const rowProps = {
    onContextMenu: (e) => {
      if (window.getSelection()?.toString()) return;
      if (!menuRef.current) return;
      e.preventDefault();
      menuRef.current.open();
    },
    onTouchStart: () => {
      pressTimer.current = setTimeout(() => menuRef.current?.open(), LONG_PRESS_MS);
    },
    onTouchEnd: () => clearTimeout(pressTimer.current),
    onTouchMove: () => clearTimeout(pressTimer.current),
  };

  return (
    <div
      className={`msg${grouped ? " is-grouped" : ""}${fromMe ? " is-mine" : ""}${beingEdited ? " is-editing" : ""}`}
      {...rowProps}
    >
      {!grouped && (
        <div className="msg-meta">
          <span className={`msg-author${fromMe ? " is-mine" : ""}`}>{fromMe ? "you" : peer?.username}</span>
          <Time value={message.createdAt} />
        </div>
      )}
      <MessageMenu message={message} fromMe={fromMe} menuRef={menuRef} />
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
      {voice && <VoiceMessage voice={voice} />}
      {message.body && (
        <div className="msg-body">
          <LinkifiedText text={message.body} />
          {message.editedAt && <span className="msg-edited"> (edited)</span>}
        </div>
      )}
      {linkPreview && <LinkPreviewCard preview={linkPreview} />}
    </div>
  );
};

// Takes everything it needs as props and is memoised, so a new message or an
// unread-count change doesn't re-render every message in the conversation.
const Message = ({ message, fromMe, grouped, peer, onOpenImage }) =>
  message.call ? (
    <CallHistoryMessage message={message} fromMe={fromMe} peer={peer} />
  ) : (
    <ChatMessage message={message} fromMe={fromMe} grouped={grouped} peer={peer} onOpenImage={onOpenImage} />
  );

// Optimistic entry for an image that is still uploading, or failed to.
export const PendingImageMessage = ({ pending, grouped, onRetry, onDiscard }) => {
  const failed = pending.status === "failed";
  // At 100% the bytes are up but the server is still processing them.
  const processing = !failed && pending.progress >= 1;
  const percent = Math.round(pending.progress * 100);

  return (
    <div className={`msg is-mine${grouped ? " is-grouped" : ""}`}>
      {!grouped && (
        <div className="msg-meta">
          <span className="msg-author is-mine">you</span>
        </div>
      )}
      <MessageImage
        src={pending.previewUrl}
        width={pending.width}
        height={pending.height}
        alt={pending.caption}
        dimmed
      />
      {pending.caption && <div className="msg-body">{pending.caption}</div>}
      {failed ? (
        <div className="msg-status is-failed" role="alert">
          Not sent ·{" "}
          <button type="button" className="btn-link" onClick={() => onRetry(pending)}>
            retry
          </button>{" "}
          ·{" "}
          <button type="button" className="btn-link" onClick={() => onDiscard(pending.tempId)}>
            discard
          </button>
        </div>
      ) : (
        <div className="msg-status" role="status">
          {processing ? "processing…" : `sending ${percent}%`}
        </div>
      )}
    </div>
  );
};

export default memo(Message);

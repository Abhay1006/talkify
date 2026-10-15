import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import useGetMessages from "../../hooks/useGetMessages";
import useSendImage from "../../hooks/useSendImage";
import { useAuthContext } from "../../context/AuthContext";
import useConversation from "../../zustand/useConversations.js";
import MessageSkeleton from "../skeletons/MessageSkeletons";
import Message, { PendingImageMessage } from "./Message";
import ImageLightbox from "./ImageLightbox";

// How close to an edge (px) counts as "at" it.
const NEAR_BOTTOM = 120;
const NEAR_TOP = 80;

// Consecutive messages from the same sender within this window share one
// header, which is what keeps a long thread readable without bubbles.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

const startsGroup = (message, previous) =>
  !previous ||
  previous.call ||
  message.call ||
  previous.senderId !== message.senderId ||
  new Date(message.createdAt) - new Date(previous.createdAt) >= GROUP_WINDOW_MS;

const Messages = ({ conversation }) => {
  const { authUser } = useAuthContext();
  const { messages, loading, fetchOlder, hasOlder, loadingOlder } = useGetMessages(conversation._id);
  const allPending = useConversation((state) => state.pendingImages);
  const pending = useMemo(
    () => allPending.filter((p) => p.receiverId === conversation._id),
    [allPending, conversation._id]
  );
  const { retry, discard } = useSendImage();

  // The image viewer pages through every image loaded in this chat.
  const [lightboxId, setLightboxId] = useState(null);
  const images = useMemo(() => messages.filter((m) => m.image), [messages]);
  const lightboxIndex = images.findIndex((m) => m._id === lightboxId);
  // Stable, so the memoised messages don't re-render when it's passed down.
  const openImage = useCallback((id) => setLightboxId(id), []);

  const scrollRef = useRef(null);
  // Whether the reader is at the bottom. Only then do new messages pull the
  // view down; otherwise reading older history is left alone.
  const isNearBottom = useRef(true);
  // scrollHeight just before an older page was requested, so the view can be
  // held in place when that page is prepended above it.
  const heightBeforeOlder = useRef(null);
  const lastMessageId = useRef(null);

  const scrollToBottom = (behavior) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  };

  const loadOlder = () => {
    if (!hasOlder || loadingOlder) return;
    heightBeforeOlder.current = scrollRef.current?.scrollHeight ?? null;
    fetchOlder();
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    if (el.scrollTop < NEAR_TOP) loadOlder();
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;

    const newest = messages[messages.length - 1];

    // An older page was prepended: keep the same messages under the reader.
    if (heightBeforeOlder.current !== null && newest._id === lastMessageId.current) {
      el.scrollTop += el.scrollHeight - heightBeforeOlder.current;
      heightBeforeOlder.current = null;
      return;
    }

    if (newest._id === lastMessageId.current) return;

    const isFirstRender = lastMessageId.current === null;
    lastMessageId.current = newest._id;

    if (isFirstRender) {
      // Opening a conversation lands at the bottom with no visible travel.
      el.scrollTop = el.scrollHeight;
    } else if (isNearBottom.current || newest.senderId === authUser._id) {
      scrollToBottom("smooth");
    }
  }, [messages, authUser._id]);

  // An upload you just started always comes into view.
  useLayoutEffect(() => {
    if (pending.length) scrollToBottom("smooth");
  }, [pending.length]);

  const lastMessage = messages[messages.length - 1];

  return (
    <div
      className="messages"
      ref={scrollRef}
      onScroll={handleScroll}
      role="log"
      aria-label={`Messages with ${conversation.username}`}
    >
      {hasOlder && (
        <div className="messages-older">
          {loadingOlder ? (
            <span role="status">loading…</span>
          ) : (
            <button type="button" className="btn-link" onClick={loadOlder}>
              Load older messages
            </button>
          )}
        </div>
      )}

      {loading && [...Array(4)].map((_, idx) => <MessageSkeleton key={idx} />)}

      {!loading &&
        messages.map((message, idx) => (
          <Message
            key={message._id}
            message={message}
            fromMe={message.senderId === authUser._id}
            grouped={!startsGroup(message, messages[idx - 1])}
            peer={conversation}
            onOpenImage={openImage}
          />
        ))}

      {pending.map((p, idx) => (
        <PendingImageMessage
          key={p.tempId}
          pending={p}
          grouped={idx > 0 || (lastMessage?.senderId === authUser._id && !lastMessage.call && !loading)}
          onRetry={retry}
          onDiscard={discard}
        />
      ))}

      {!loading && messages.length === 0 && pending.length === 0 && (
        <div className="empty">No messages yet. Say something.</div>
      )}

      <ImageLightbox
        images={images}
        index={lightboxIndex}
        peer={conversation}
        onClose={() => setLightboxId(null)}
        onNavigate={(i) => setLightboxId(images[i]._id)}
      />
    </div>
  );
};

export default Messages;

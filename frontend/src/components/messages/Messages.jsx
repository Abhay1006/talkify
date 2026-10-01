import { useLayoutEffect, useRef } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import useGetMessages from "../../hooks/useGetMessages";
import { useAuthContext } from "../../context/AuthContext";
import MessageSkeleton from "../skeletons/MessageSkeletons";
import Message from "./Message";

// How close to an edge (px) counts as "at" it.
const NEAR_BOTTOM = 120;
const NEAR_TOP = 80;

const Messages = ({ conversation }) => {
  const { authUser } = useAuthContext();
  const { messages, loading, fetchOlder, hasOlder, loadingOlder } = useGetMessages(conversation._id);

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  // Whether the reader is at the bottom. Only then do new messages pull the
  // view down; otherwise reading older history is left alone.
  const isNearBottom = useRef(true);
  // scrollHeight just before an older page was requested, so the view can be
  // held in place when that page is prepended above it.
  const heightBeforeOlder = useRef(null);
  const lastMessageId = useRef(null);

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
      // Jump straight to the latest message. Smooth-scrolling through the
      // whole history on open was slow and disorienting.
      el.scrollTop = el.scrollHeight;
    } else if (isNearBottom.current || newest.senderId === authUser._id) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, authUser._id]);

  return (
    <Box
      ref={scrollRef}
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
      aria-label={`Messages with ${conversation.fullName}`}
      sx={{
        px: { xs: 1.5, sm: 4 },
        py: { xs: 1, sm: 2 },
        flex: 1,
        overflow: 'auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'contain',
      }}
    >
      {hasOlder && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          {loadingOlder ? (
            <CircularProgress size={20} aria-label="Loading older messages" />
          ) : (
            <Button size="small" onClick={loadOlder}>Load older messages</Button>
          )}
        </Box>
      )}

      {!loading &&
        messages.map((message) => (
          <Message
            key={message._id}
            message={message}
            fromMe={message.senderId === authUser._id}
            profilePic={message.senderId === authUser._id ? authUser.profilePic : conversation.profilePic}
          />
        ))}

      {loading && [...Array(3)].map((_, idx) => <MessageSkeleton key={idx} />)}

      {!loading && messages.length === 0 && (
        <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
            Send a message to start the conversation
          </Typography>
        </Box>
      )}

      <Box ref={bottomRef} />
    </Box>
  );
};

export default Messages;

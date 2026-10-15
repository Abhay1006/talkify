import { useEffect, useMemo, useRef, useState } from "react";
import useGetMessages from "../../hooks/useGetMessages";
import MessageSkeleton from "../skeletons/MessageSkeletons";
import Message, { PendingImageMessage } from "./Message";
import ImageLightbox from "./ImageLightbox";
import useListenMessages from "../../hooks/useListenMessages";
import useSendImage from "../../hooks/useSendImage";
import useConversation from "../../zustand/useConversations";
import { Box, Typography } from "@mui/material";

const Messages = () => {
  const { messages, loading } = useGetMessages();
  useListenMessages();
  const { selectedConversation, pendingImages } = useConversation();
  const { retry, discard } = useSendImage();
  const [lightboxId, setLightboxId] = useState(null);

  const pending = pendingImages.filter((p) => p.receiverId === selectedConversation?._id);
  const images = useMemo(() => messages.filter((m) => m.image), [messages]);
  const lightboxIndex = images.findIndex((m) => m._id === lightboxId);

  useEffect(() => setLightboxId(null), [selectedConversation?._id]);

  // A single sentinel at the end of the list. The ref used to be attached to
  // every message inside the map, which only worked because the last write won.
  const bottomRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, pending.length]);

  return (
    <Box sx={{
      px: { xs: 1.5, sm: 4 },
      py: { xs: 1, sm: 2 },
      flex: 1,
      overflow: 'auto',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      WebkitOverflowScrolling: 'touch',
      overscrollBehaviorY: 'contain',
    }}>
      {!loading &&
        messages.length > 0 &&
        messages.map((message) => <Message key={message._id} message={message} onOpenImage={setLightboxId} />)}

      {pending.map((p) => (
        <PendingImageMessage key={p.tempId} pending={p} onRetry={retry} onDiscard={discard} />
      ))}

      {loading && [...Array(3)].map((_, idx) => <MessageSkeleton key={idx} />)}
      
      {!loading && messages.length === 0 && pending.length === 0 && (
        <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
            Send a message to start the conversation
          </Typography>
        </Box>
      )}

      <Box ref={bottomRef} />

      <ImageLightbox
        images={images}
        index={lightboxIndex}
        onClose={() => setLightboxId(null)}
        onNavigate={(i) => setLightboxId(images[i]._id)}
      />
    </Box>
  );
};

export default Messages;

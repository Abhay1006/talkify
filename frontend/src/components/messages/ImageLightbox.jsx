import { useEffect, useRef, useState } from "react";
import { Box, Dialog, IconButton, Typography } from "@mui/material";
import { FiChevronLeft, FiChevronRight, FiDownload, FiX } from "react-icons/fi";
import { useAuthContext } from "../../context/AuthContext";
import useConversation from "../../zustand/useConversations";
import { extractTime } from "../../utils/extractTime";
import { mediaUrl } from "../../utils/prepareImage";

const SWIPE_THRESHOLD = 50;

const navButtonSx = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  color: "white",
  bgcolor: "rgba(0,0,0,0.4)",
  width: 44,
  height: 44,
  "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
};

// Full-screen viewer for every image in the open conversation, with arrow
// keys and swipe to move between them.
const ImageLightbox = ({ images, index, onClose, onNavigate }) => {
  const { authUser } = useAuthContext();
  const { selectedConversation } = useConversation();
  const [loaded, setLoaded] = useState(false);
  const touchStartX = useRef(null);

  const open = index >= 0 && index < images.length;
  const message = open ? images[index] : null;
  const hasPrev = open && index > 0;
  const hasNext = open && index < images.length - 1;

  useEffect(() => setLoaded(false), [message?._id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(index - 1);
      if (e.key === "ArrowRight" && hasNext) onNavigate(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, hasPrev, hasNext, onNavigate]);

  if (!message) return null;

  const { image } = message;
  const fromMe = message.senderId === authUser._id;
  const sender = fromMe ? "You" : selectedConversation?.fullName;

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx > SWIPE_THRESHOLD && hasPrev) onNavigate(index - 1);
    if (dx < -SWIPE_THRESHOLD && hasNext) onNavigate(index + 1);
  };

  const imgSx = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" };

  return (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      slotProps={{ paper: {
        "aria-label": "Image viewer",
        sx: { bgcolor: "#05060a", backdropFilter: "none", WebkitBackdropFilter: "none", border: "none", boxShadow: "none", borderRadius: 0 },
      } }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", pt: "env(safe-area-inset-top)", pb: "env(safe-area-inset-bottom)" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: { xs: 1, sm: 2 }, py: 1, color: "white" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>{sender}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {extractTime(message.createdAt)}
              {images.length > 1 && ` · ${index + 1} of ${images.length}`}
            </Typography>
          </Box>
          <IconButton
            component="a"
            href={mediaUrl(image.fullId)}
            download={`talkify-${image.fullId}.webp`}
            aria-label="Download image"
            sx={{ color: "white", width: 44, height: 44 }}
          >
            <FiDownload size={20} />
          </IconButton>
          <IconButton onClick={onClose} aria-label="Close image viewer" sx={{ color: "white", width: 44, height: 44 }}>
            <FiX size={22} />
          </IconButton>
        </Box>

        <Box onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} sx={{ position: "relative", flex: 1, minHeight: 0, mx: { xs: 0, sm: 8 } }}>
          {/* The thumbnail is almost always cached already: show it at once,
              then swap in the full-size image when it arrives. */}
          {!loaded && <Box component="img" src={mediaUrl(image.thumbId)} alt="" aria-hidden sx={imgSx} />}
          <Box
            key={image.fullId}
            component="img"
            src={mediaUrl(image.fullId)}
            alt={message.body || "Image"}
            onLoad={() => setLoaded(true)}
            sx={{ ...imgSx, opacity: loaded ? 1 : 0 }}
          />
        </Box>

        {hasPrev && (
          <IconButton onClick={() => onNavigate(index - 1)} aria-label="Previous image" sx={{ ...navButtonSx, left: { xs: 8, sm: 16 } }}>
            <FiChevronLeft size={24} />
          </IconButton>
        )}
        {hasNext && (
          <IconButton onClick={() => onNavigate(index + 1)} aria-label="Next image" sx={{ ...navButtonSx, right: { xs: 8, sm: 16 } }}>
            <FiChevronRight size={24} />
          </IconButton>
        )}

        {message.body && (
          <Typography sx={{ color: "white", textAlign: "center", px: 3, py: 2, wordBreak: "break-word", maxHeight: "25vh", overflow: "auto" }}>
            {message.body}
          </Typography>
        )}
      </Box>
    </Dialog>
  );
};

export default ImageLightbox;

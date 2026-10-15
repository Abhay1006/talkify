import { useEffect, useRef, useState } from "react";
import { useAuthContext } from "../../context/AuthContext";
import { formatMessageTime } from "../../utils/formatMessageTime";
import { mediaUrl } from "../../utils/prepareImage";
import Dialog from "../ui/Dialog";

const SWIPE_THRESHOLD = 50;

// Full-screen viewer for every image in the open conversation, with arrow
// keys and swipe to move between them.
const ImageLightbox = ({ images, index, peer, onClose, onNavigate }) => {
  const { authUser } = useAuthContext();
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

  const image = message?.image;
  const sender = message && (message.senderId === authUser._id ? "you" : peer?.username);

  return (
    <Dialog open={open} onClose={onClose} label="Image viewer" className="lightbox">
      {message && (
        <>
          <div className="lightbox-bar">
            <div className="lightbox-meta">
              <span className="lightbox-sender">{sender}</span>
              <span className="lightbox-sub">
                {formatMessageTime(message.createdAt)}
                {images.length > 1 && ` · ${index + 1} of ${images.length}`}
              </span>
            </div>
            <a
              className="lightbox-btn"
              href={mediaUrl(image.fullId)}
              download={`talkify-${image.fullId}.webp`}
            >
              download
            </a>
            <button type="button" className="lightbox-btn" onClick={onClose}>
              close
            </button>
          </div>

          <div className="lightbox-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {/* The thumbnail is almost always cached already: show it at once,
                then swap in the full-size image when it arrives. */}
            {!loaded && (
              <img className="lightbox-img" src={mediaUrl(image.thumbId)} alt="" aria-hidden="true" />
            )}
            <img
              key={image.fullId}
              className={`lightbox-img${loaded ? "" : " is-loading"}`}
              src={mediaUrl(image.fullId)}
              alt={message.body || "Image"}
              onLoad={() => setLoaded(true)}
            />
            {hasPrev && (
              <button
                type="button"
                className="lightbox-nav is-prev"
                onClick={() => onNavigate(index - 1)}
                aria-label="Previous image"
              >
                ‹
              </button>
            )}
            {hasNext && (
              <button
                type="button"
                className="lightbox-nav is-next"
                onClick={() => onNavigate(index + 1)}
                aria-label="Next image"
              >
                ›
              </button>
            )}
          </div>

          {message.body && <p className="lightbox-caption">{message.body}</p>}
        </>
      )}
    </Dialog>
  );
};

export default ImageLightbox;

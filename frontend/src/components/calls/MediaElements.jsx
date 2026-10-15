import { useEffect, useRef } from "react";

// Binds a MediaStream to a <video>/<audio>. `version` forces a re-bind when
// tracks are added to the same stream object.
const useStream = (stream, version) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream ?? null;
    if (stream) el.play?.().catch(() => {});
  }, [stream, version]);
  return ref;
};

export const StreamAudio = ({ stream, version }) => {
  const ref = useStream(stream, version);
  return <audio ref={ref} autoPlay />;
};

export const StreamVideo = ({ stream, version, mirrored, className = "", label }) => {
  const ref = useStream(stream, version);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      // Audio always plays through StreamAudio; a second copy here would echo.
      muted
      aria-label={label}
      className={`stream-video${mirrored ? " is-mirrored" : ""} ${className}`}
    />
  );
};

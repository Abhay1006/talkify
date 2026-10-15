import { useEffect, useRef, useState } from "react";
import { Box, IconButton } from "@mui/material";
import { FiPause, FiPlay } from "react-icons/fi";
import { mediaUrl } from "../../utils/prepareImage";
import { formatDuration } from "../../calls/callText";

// Only one voice message plays at a time.
let nowPlaying = null;

const BAR_COUNT = 48;

const VoiceMessage = ({ voice, fromMe }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0); // seconds
  const durationSec = voice.durationMs / 1000;
  const progress = Math.min(1, position / durationSec);

  const bars = voice.waveform?.length ? voice.waveform : Array(BAR_COUNT).fill(0.3);

  useEffect(() => () => {
    if (nowPlaying === audioRef.current) nowPlaying = null;
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (nowPlaying && nowPlaying !== audio) nowPlaying.pause();
      nowPlaying = audio;
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  };

  const seek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = fraction * durationSec;
    setPosition(audio.currentTime);
  };

  const played = fromMe ? "rgba(255,255,255,0.95)" : "#8A84FF";
  const unplayed = fromMe ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.25)";

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.25, width: { xs: 220, sm: 260 }, maxWidth: "100%" }}>
      <audio
        ref={audioRef}
        src={mediaUrl(voice.mediaId)}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setPosition(0); }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
      />
      <IconButton
        onClick={toggle}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        sx={{ width: 36, height: 36, flexShrink: 0, bgcolor: fromMe ? "rgba(255,255,255,0.2)" : "rgba(108,99,255,0.25)", color: "white", "&:hover": { bgcolor: fromMe ? "rgba(255,255,255,0.3)" : "rgba(108,99,255,0.4)" } }}
      >
        {playing ? <FiPause size={16} /> : <FiPlay size={16} style={{ marginLeft: 2 }} />}
      </IconButton>
      <Box
        onClick={seek}
        role="slider"
        aria-label="Voice message position"
        aria-valuemin={0}
        aria-valuemax={Math.round(durationSec)}
        aria-valuenow={Math.round(position)}
        tabIndex={0}
        onKeyDown={(e) => {
          const audio = audioRef.current;
          if (!audio) return;
          if (e.key === "ArrowRight") audio.currentTime = Math.min(durationSec, audio.currentTime + 5);
          if (e.key === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 5);
        }}
        sx={{ flex: 1, display: "flex", alignItems: "center", gap: "2px", height: 28, cursor: "pointer", minWidth: 0 }}
      >
        {bars.map((level, i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              minWidth: "2px",
              height: `${Math.max(12, level * 100)}%`,
              borderRadius: "2px",
              bgcolor: (i + 0.5) / bars.length <= progress ? played : unplayed,
            }}
          />
        ))}
      </Box>
      <Box component="span" sx={{ fontSize: "0.7rem", fontVariantNumeric: "tabular-nums", opacity: 0.85, flexShrink: 0, minWidth: 30, textAlign: "right" }}>
        {formatDuration((playing || position > 0 ? position : durationSec) * 1000)}
      </Box>
    </Box>
  );
};

export default VoiceMessage;

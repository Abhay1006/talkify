import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "../../utils/prepareImage";
import { formatDuration } from "../../calls/callText";

// Only one voice message plays at a time.
let nowPlaying = null;

const BAR_COUNT = 48;

const VoiceMessage = ({ voice }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0); // seconds
  const durationSec = voice.durationMs / 1000;
  const progress = Math.min(1, position / durationSec);

  const bars = voice.waveform?.length ? voice.waveform : Array(BAR_COUNT).fill(0.3);

  useEffect(
    () => () => {
      if (nowPlaying === audioRef.current) nowPlaying = null;
    },
    []
  );

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

  return (
    <div className="voice">
      <audio
        ref={audioRef}
        src={mediaUrl(voice.mediaId)}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
      />
      <button
        type="button"
        className="icon-btn voice-toggle"
        onClick={toggle}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div
        className="voice-wave"
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
      >
        {bars.map((level, i) => (
          <span
            key={i}
            className={`voice-bar${(i + 0.5) / bars.length <= progress ? " is-played" : ""}`}
            style={{ height: `${Math.max(12, level * 100)}%` }}
          />
        ))}
      </div>
      <span className="voice-time">
        {formatDuration((playing || position > 0 ? position : durationSec) * 1000)}
      </span>
    </div>
  );
};

export default VoiceMessage;

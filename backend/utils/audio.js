// Voice notes are stored as recorded: there is no ffmpeg on the server to
// re-encode audio the way images are re-encoded through sharp. So the
// container is identified from its magic bytes (never the client's
// Content-Type), and the file is served with exactly that type, nosniff and a
// sandboxing CSP — a polyglot can't be rendered as anything but audio.

export const MAX_VOICE_BYTES = 3 * 1024 * 1024;
export const MAX_VOICE_MS = 5 * 60 * 1000;
export const MIN_VOICE_MS = 300;
export const WAVEFORM_BARS = 48;

const MP4_BRANDS = new Set(["M4A ", "mp42", "mp41", "isom", "iso2", "iso5", "iso6", "dash", "M4B "]);

/** Returns the audio MIME type for a buffer, or null if it isn't one we accept. */
export const sniffAudio = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 16) return null;

  // WebM (Chrome, Firefox, Edge MediaRecorder): EBML header + "webm" DocType.
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return buf.subarray(0, 64).includes("webm") ? "audio/webm" : null;
  }
  // Ogg Opus (Firefox can record this).
  if (buf.subarray(0, 4).toString("latin1") === "OggS") {
    return buf.subarray(0, 128).includes("OpusHead") ? "audio/ogg" : null;
  }
  // MP4/M4A (Safari MediaRecorder).
  if (
    buf.subarray(4, 8).toString("latin1") === "ftyp" &&
    MP4_BRANDS.has(buf.subarray(8, 12).toString("latin1"))
  ) {
    return "audio/mp4";
  }
  return null;
};

/** Accepts a JSON array of levels, coerced to WAVEFORM_BARS numbers in 0..1. */
export const parseWaveform = (raw) => {
  let values;
  try {
    values = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(values)) return [];
  return values
    .slice(0, WAVEFORM_BARS)
    .map((v) =>
      typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 100) / 100 : 0
    );
};

import { useCallback, useEffect, useRef, useState } from "react";

// Records a voice message with MediaRecorder and samples the input level for
// a waveform. Opus in WebM/Ogg where supported (Chrome, Firefox, Edge), AAC
// in MP4 on Safari.

export const MAX_RECORDING_MS = 5 * 60 * 1000;
const SAMPLE_INTERVAL_MS = 80;
const WAVEFORM_BARS = 48;

const MIME_PREFERENCES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];

const pickMimeType = () =>
  typeof MediaRecorder !== "undefined"
    ? (MIME_PREFERENCES.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "")
    : null;

// Averages raw level samples down to WAVEFORM_BARS bars, scaled so the
// loudest bar is full height.
const toWaveform = (samples) => {
  if (!samples.length) return [];
  const bars = [];
  for (let i = 0; i < WAVEFORM_BARS; i++) {
    const start = Math.floor((i * samples.length) / WAVEFORM_BARS);
    const end = Math.max(start + 1, Math.floor(((i + 1) * samples.length) / WAVEFORM_BARS));
    const slice = samples.slice(start, end);
    bars.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  const peak = Math.max(...bars, 0.01);
  return bars.map((b) => Math.round(Math.min(1, b / peak) * 100) / 100);
};

export class RecorderError extends Error {}

const useVoiceRecorder = ({ onMaxDuration } = {}) => {
  const [state, setState] = useState({ recording: false, elapsedMs: 0, level: 0 });
  const r = useRef({});
  const onMaxRef = useRef(onMaxDuration);
  onMaxRef.current = onMaxDuration;

  const cleanup = useCallback(() => {
    const cur = r.current;
    clearInterval(cur.timer);
    cur.stream?.getTracks().forEach((t) => t.stop());
    cur.audioContext?.close().catch(() => {});
    r.current = {};
    setState({ recording: false, elapsedMs: 0, level: 0 });
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    const mimeType = pickMimeType();
    if (mimeType === null || !navigator.mediaDevices?.getUserMedia) {
      throw new RecorderError("Voice messages aren’t supported in this browser");
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (error) {
      throw new RecorderError(
        error.name === "NotAllowedError"
          ? "Microphone access is blocked for this site"
          : "Couldn’t access your microphone"
      );
    }

    const recorder = new MediaRecorder(stream, { ...(mimeType && { mimeType }), audioBitsPerSecond: 32000 });
    const chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    // Level meter for the live display and the saved waveform.
    const Ctor = window.AudioContext || window.webkitAudioContext;
    const audioContext = new Ctor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    const samples = [];

    const startedAt = Date.now();
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (const v of buffer) sum += v * v;
      const level = Math.min(1, Math.sqrt(sum / buffer.length) * 4);
      samples.push(level);
      const elapsedMs = Date.now() - startedAt;
      setState({ recording: true, elapsedMs, level });
      if (elapsedMs >= MAX_RECORDING_MS) onMaxRef.current?.();
    }, SAMPLE_INTERVAL_MS);

    recorder.start(250);
    r.current = { stream, recorder, chunks, audioContext, samples, startedAt, timer };
    setState({ recording: true, elapsedMs: 0, level: 0 });
  }, []);

  /** Stops and resolves to { blob, durationMs, waveform }. */
  const stop = useCallback(
    () =>
      new Promise((resolve) => {
        const { recorder, chunks, samples, startedAt } = r.current;
        if (!recorder) return resolve(null);
        recorder.onstop = () => {
          const durationMs = Math.min(MAX_RECORDING_MS, Date.now() - startedAt);
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          const waveform = toWaveform(samples);
          cleanup();
          resolve({ blob, durationMs, waveform });
        };
        recorder.stop();
      }),
    [cleanup]
  );

  const cancel = useCallback(() => {
    const { recorder } = r.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
  }, [cleanup]);

  return { ...state, start, stop, cancel };
};

export default useVoiceRecorder;

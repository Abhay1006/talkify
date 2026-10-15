// Ringtone and ringback generated with WebAudio: no sound files to ship, and
// nothing to fetch at the moment a call arrives.

let ctx = null;

const audioContext = () => {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  // Browsers suspend audio until the page has been interacted with; this is a
  // no-op where that hasn't happened yet, and the ring is simply silent.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

const beep = (context, { freqs, start, duration, gain = 0.08 }) => {
  const out = context.createGain();
  out.gain.setValueAtTime(0, start);
  out.gain.linearRampToValueAtTime(gain, start + 0.02);
  out.gain.setValueAtTime(gain, start + duration - 0.03);
  out.gain.linearRampToValueAtTime(0, start + duration);
  out.connect(context.destination);
  for (const freq of freqs) {
    const osc = context.createOscillator();
    osc.frequency.value = freq;
    osc.connect(out);
    osc.start(start);
    osc.stop(start + duration);
  }
};

const PATTERNS = {
  // Incoming call: two bright pips, repeated.
  ringtone: {
    period: 2000,
    play: (c, t) => {
      beep(c, { freqs: [784, 988], start: t, duration: 0.18, gain: 0.1 });
      beep(c, { freqs: [784, 988], start: t + 0.28, duration: 0.18, gain: 0.1 });
    },
  },
  // Outgoing call waiting for an answer: the familiar long tone.
  ringback: {
    period: 4000,
    play: (c, t) => beep(c, { freqs: [440, 480], start: t, duration: 1.6, gain: 0.05 }),
  },
};

let loop = null;

export const startTone = (name) => {
  stopTone();
  const pattern = PATTERNS[name];
  const context = audioContext();
  if (!pattern || !context) return;
  const tick = () => pattern.play(context, context.currentTime + 0.05);
  tick();
  loop = setInterval(tick, pattern.period);
};

export const stopTone = () => {
  clearInterval(loop);
  loop = null;
};

/** Short descending blip when a call ends. */
export const playEndTone = () => {
  const context = audioContext();
  if (!context) return;
  const t = context.currentTime + 0.02;
  beep(context, { freqs: [660], start: t, duration: 0.12 });
  beep(context, { freqs: [440], start: t + 0.15, duration: 0.18 });
};

// Every user-facing string about call state, in one place.

export const formatDuration = (ms) => {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

export const kindLabel = (kind) => (kind === 'video' ? 'Video call' : 'Voice call');

export const phaseLabel = (call) => {
  switch (call.phase) {
    case 'preparing': return 'Starting…';
    case 'calling': return 'Calling…';
    case 'ringing': return 'Ringing…';
    case 'connecting': return 'Connecting…';
    case 'reconnecting': return 'Reconnecting…';
    default: return '';
  }
};

export const endReasonLabel = (reason, peerName) => {
  const name = peerName || 'They';
  switch (reason) {
    case 'hangup':
    case 'hangup_by_me':
    case 'ended': return 'Call ended';
    case 'declined': return `${name} declined the call`;
    case 'no_answer': return 'No answer';
    case 'busy': return `${name} is on another call`;
    case 'unavailable': return `${name} is offline. They'll see a missed call.`;
    case 'forbidden': return "You can't call this person";
    case 'rate_limited': return 'Too many calls. Wait a minute and try again.';
    case 'already_in_call': return "You're already in a call on another tab";
    case 'not_connected': return "You're offline. Check your connection.";
    case 'cancelled_by_me': return 'Call cancelled';
    case 'answered_elsewhere': return 'Answered on another device';
    case 'gone': return 'This call has already ended';
    case 'disconnected': return 'Connection lost';
    default: return 'Call ended';
  }
};

// Decision 3: STUN-only means some networks can't connect. Say so plainly
// rather than leaving the user staring at a spinner.
export const failureLabel = (failure) =>
  failure === 'lost'
    ? 'The connection was lost and couldn’t be recovered.'
    : 'Couldn’t connect. This can happen on some mobile and office networks.';

export const errorHelp = (code) => {
  switch (code) {
    case 'permission_denied':
      return {
        title: 'Microphone access is blocked',
        body: 'Allow microphone access for this site (use the icon at the left of the address bar, or your browser’s site settings), then try again.',
      };
    case 'permission_denied_video':
      return {
        title: 'Camera or microphone access is blocked',
        body: 'Allow camera and microphone access for this site (use the icon at the left of the address bar, or your browser’s site settings), then try again.',
      };
    case 'no_microphone':
      return { title: 'No microphone found', body: 'Connect a microphone or headset and try again.' };
    case 'device_busy':
      return { title: 'Your microphone is in use', body: 'Another app is using your microphone. Close it and try again.' };
    case 'insecure':
      return { title: 'Calls need a secure connection', body: 'Open Talkify over https:// to make calls.' };
    case 'unsupported':
      return { title: 'Calls aren’t supported here', body: 'This browser can’t make calls. Try a recent Chrome, Firefox, Edge or Safari.' };
    default:
      return { title: 'Couldn’t start the call', body: 'Something went wrong accessing your microphone or camera. Try again.' };
  }
};

export const noticeLabel = (notice) => {
  switch (notice) {
    case 'camera_missing': return 'No camera available. Continuing with audio only.';
    case 'camera_busy': return 'Your camera is in use by another app. Continuing with audio only.';
    case 'camera_denied': return 'Camera access is blocked for this site.';
    default: return null;
  }
};

/** Text for a call-history line, from the reader's point of view. */
export const historyLabel = (call, fromMe) => {
  const kind = call.kind === 'video' ? 'video call' : 'voice call';
  const Kind = call.kind === 'video' ? 'Video call' : 'Voice call';
  if (call.status === 'completed') return `${Kind} · ${formatDuration(call.durationMs)}`;
  if (call.status === 'declined') return fromMe ? `${Kind} · Declined` : `Declined ${kind}`;
  return fromMe ? `${Kind} · No answer` : `Missed ${kind}`;
};

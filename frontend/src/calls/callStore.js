import { create } from 'zustand';

// UI-facing call state. The RTCPeerConnection and other non-serialisable
// machinery live in callEngine.js; components only read from here.
//
// call.phase:
//   preparing   caller is getting mic/camera before ringing anyone
//   calling     invite sent, waiting for the callee's device
//   ringing     callee's device is ringing
//   incoming    this tab is being called
//   connecting  accepted, WebRTC negotiating
//   active      media flowing
//   reconnecting media path dropped; trying to recover
//   ended       finished; screen closes shortly (call.endReason says why)
//   failed      couldn't connect / lost connection; offers Retry
//   error       couldn't start (permissions, no device); call.error says why
export const useCallStore = create(() => ({
  call: null,
  localStream: null,
  remoteStream: null,
  // Bumped whenever a remote track is added, so video/audio elements re-bind.
  remoteVersion: 0,
  micOn: true,
  camOn: false,
  facingMode: 'user',
  canFlipCamera: false,
  peerMicOn: true,
  peerCamOn: false,
  peerReconnecting: false,
  quality: null, // 'good' | 'fair' | 'poor'
  // A call this user is in, but which this tab has no media for (e.g. after a
  // reload). { callId, role, kind, peerId }
  resumable: null,
}));

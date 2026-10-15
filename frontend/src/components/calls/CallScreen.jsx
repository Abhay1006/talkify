import { useEffect, useRef, useState } from "react";
import { useCallStore } from "../../calls/callStore";
import {
  hangUp,
  toggleMic,
  toggleCamera,
  flipCamera,
  retryCall,
  dismissCall,
  clearNotice,
} from "../../calls/callEngine";
import {
  formatDuration,
  kindLabel,
  phaseLabel,
  endReasonLabel,
  failureLabel,
  errorHelp,
  noticeLabel,
} from "../../calls/callText";
import { StreamAudio, StreamVideo } from "./MediaElements";
import Dialog from "../ui/Dialog";

const LIVE_PHASES = new Set(["connecting", "active", "reconnecting"]);

const Timer = ({ since }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{formatDuration(now - since)}</>;
};

const QUALITY_LEVEL = { good: 3, fair: 2, poor: 1 };

const QualityBars = ({ quality }) => {
  if (!quality) return null;
  const level = QUALITY_LEVEL[quality];
  return (
    <span
      className={`quality is-${quality}`}
      role="img"
      aria-label={`Connection quality ${quality}`}
      title={`Connection: ${quality}`}
    >
      {[1, 2, 3].map((i) => (
        <span key={i} className={`quality-bar is-${i}${i <= level ? " is-on" : ""}`} />
      ))}
    </span>
  );
};

// Off toggles render inverted, so a muted mic is obvious at a glance.
const ControlButton = ({ label, active = true, danger, onClick, children }) => (
  <button
    type="button"
    className={`call-ctrl${danger ? " is-danger" : ""}${!active && !danger ? " is-off" : ""}`}
    onClick={onClick}
    aria-label={label}
    aria-pressed={danger ? undefined : !active}
    title={label}
  >
    {children}
  </button>
);

// Your own camera in a corner. Drag it anywhere; it stays on screen.
const SelfView = ({ stream, mirrored }) => {
  const [pos, setPos] = useState(null);
  const drag = useRef(null);
  const boxRef = useRef(null);

  const onPointerDown = (e) => {
    const rect = boxRef.current.getBoundingClientRect();
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const el = boxRef.current;
    const parent = el.parentElement.getBoundingClientRect();
    const x = Math.min(
      Math.max(8, e.clientX - parent.left - drag.current.dx),
      parent.width - el.offsetWidth - 8
    );
    const y = Math.min(
      Math.max(8, e.clientY - parent.top - drag.current.dy),
      parent.height - el.offsetHeight - 8
    );
    setPos({ x, y });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div
      ref={boxRef}
      className="self-view"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={pos ? { left: pos.x, top: pos.y, right: "auto" } : undefined}
    >
      <StreamVideo stream={stream} mirrored={mirrored} label="Your camera" />
    </div>
  );
};

const CallScreen = ({ call }) => {
  const {
    localStream,
    remoteStream,
    remoteVersion,
    micOn,
    camOn,
    facingMode,
    canFlipCamera,
    peerCamOn,
    peerMicOn,
    peerReconnecting,
    quality,
  } = useCallStore();

  const { phase, peer, kind } = call;
  const name = peer?.username ?? peer?.fullName ?? "";
  const live = LIVE_PHASES.has(phase);
  const outgoing = phase === "preparing" || phase === "calling" || phase === "ringing";
  const showRemoteVideo = live && peerCamOn && remoteStream;
  // While ringing out on a video call, your own camera fills the screen.
  const showLocalFull = outgoing && camOn && localStream;
  const showSelfView = live && camOn && localStream;
  const notice = noticeLabel(call.notice);
  const hasVideo = Boolean(showRemoteVideo || showLocalFull);

  // Notices are informational; fade them after a few seconds.
  useEffect(() => {
    if (!call.notice) return;
    const id = setTimeout(clearNotice, 5000);
    return () => clearTimeout(id);
  }, [call.notice]);

  let status = phaseLabel(call);
  if (phase === "active" && call.connectedAt) status = <Timer since={call.connectedAt} />;
  if (phase === "ended") status = endReasonLabel(call.endReason, name);

  return (
    // A modal <dialog> so it sits in the top layer, above any other open
    // dialog (an image viewer, the profile), rather than under its inert
    // backdrop.
    <Dialog
      open
      dismissible={false}
      className={`call-screen${hasVideo ? " has-video" : ""}`}
      label={`${kindLabel(kind)} with ${name}`}
    >
      {live && <StreamAudio stream={remoteStream} version={remoteVersion} />}

      {showRemoteVideo && (
        <StreamVideo
          stream={remoteStream}
          version={remoteVersion}
          label={`${name}'s camera`}
          className="call-remote"
        />
      )}
      {showLocalFull && (
        <StreamVideo
          stream={localStream}
          mirrored={facingMode === "user"}
          label="Your camera"
          className="call-remote is-preview"
        />
      )}

      <div className="call-top">
        <span>{kindLabel(kind)}</span>
        {phase === "active" && <QualityBars quality={quality} />}
        <span className="call-top-spacer" />
        {showRemoteVideo && (
          <span className="call-top-name">
            {name} · {status}
          </span>
        )}
      </div>

      <div className="call-banners">
        {(peerReconnecting || phase === "reconnecting") && (
          <div className="call-banner" role="status">
            {peerReconnecting
              ? `${name}'s connection is unstable…`
              : "Your connection is unstable. Reconnecting…"}
          </div>
        )}
        {live && !peerMicOn && (
          <div className="call-banner" role="status">
            {name} is muted
          </div>
        )}
        {notice && (
          <div className="call-banner" role="status">
            {notice}
          </div>
        )}
      </div>

      {/* Centre: who you're talking to, when there's no video to show. */}
      <div className="call-centre">
        {showRemoteVideo ? null : phase === "error" ? (
          <ErrorPanel code={call.error} />
        ) : (
          <>
            <div className="call-name">{name}</div>
            {peer?.fullName && peer?.username && <div className="call-subname">{peer.fullName}</div>}
            <div className="call-status" aria-live="polite">
              {phase === "failed" ? failureLabel(call.failure) : status}
            </div>
            {live && kind === "video" && !peerCamOn && phase === "active" && (
              <div className="call-subname">{name}&apos;s camera is off</div>
            )}
          </>
        )}
      </div>

      {showSelfView && <SelfView stream={localStream} mirrored={facingMode === "user"} />}

      <div className="call-controls">
        {phase === "failed" || phase === "error" ? (
          <>
            <button type="button" className="call-ctrl" onClick={dismissCall}>
              Close
            </button>
            <button type="button" className="call-ctrl is-primary" onClick={retryCall}>
              Try again
            </button>
          </>
        ) : phase === "ended" ? (
          <span className="call-ctrl-placeholder" />
        ) : (
          <>
            <ControlButton label={micOn ? "Mute" : "Unmute"} active={micOn} onClick={toggleMic}>
              {micOn ? "mute" : "unmute"}
            </ControlButton>
            <ControlButton
              label={camOn ? "Turn camera off" : "Turn camera on"}
              active={camOn}
              onClick={toggleCamera}
            >
              {camOn ? "camera off" : "camera on"}
            </ControlButton>
            {camOn && canFlipCamera && (
              <ControlButton label="Switch camera" onClick={flipCamera}>
                flip
              </ControlButton>
            )}
            <ControlButton label={outgoing ? "Cancel call" : "End call"} danger onClick={hangUp}>
              {outgoing ? "cancel" : "end"}
            </ControlButton>
          </>
        )}
      </div>
    </Dialog>
  );
};

const ErrorPanel = ({ code }) => {
  const { title, body } = errorHelp(code);
  return (
    <div className="call-error">
      <div className="call-error-title">{title}</div>
      <p>{body}</p>
    </div>
  );
};

export default CallScreen;

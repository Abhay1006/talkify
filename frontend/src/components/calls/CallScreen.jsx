import { useEffect, useRef, useState } from "react";
import { Avatar, Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import {
  MicNoneOutlined,
  MicOffOutlined,
  VideocamOutlined,
  VideocamOffOutlined,
  CallEnd,
  CameraswitchOutlined,
  Refresh,
  WarningAmberOutlined,
  Close,
} from "@mui/icons-material";
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

const LIVE_PHASES = new Set(["connecting", "active", "reconnecting"]);

const Timer = ({ since }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{formatDuration(now - since)}</>;
};

const QualityBars = ({ quality }) => {
  if (!quality) return null;
  const level = { good: 3, fair: 2, poor: 1 }[quality];
  const color = { good: "#30a46c", fair: "#f5a524", poor: "#e5484d" }[quality];
  return (
    <Tooltip title={`Connection: ${quality}`}>
      <Box
        role="img"
        aria-label={`Connection quality ${quality}`}
        sx={{ display: "flex", alignItems: "flex-end", gap: "2px", height: 14 }}
      >
        {[1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{
              width: 4,
              height: 4 + i * 3,
              borderRadius: "1px",
              bgcolor: i <= level ? color : "rgba(255,255,255,0.25)",
            }}
          />
        ))}
      </Box>
    </Tooltip>
  );
};

const ControlButton = ({ label, active = true, danger, onClick, children }) => (
  <Tooltip title={label}>
    <IconButton
      onClick={onClick}
      aria-label={label}
      aria-pressed={danger ? undefined : !active}
      sx={{
        width: { xs: 56, sm: 60 },
        height: { xs: 56, sm: 60 },
        // "Off" toggles invert to white, so a muted mic is obvious at a glance.
        color: !active && !danger ? "#111" : "white",
        bgcolor: danger ? "#e5484d" : active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.9)",
        "&:hover": { bgcolor: danger ? "#d13d42" : active ? "rgba(255,255,255,0.22)" : "white" },
      }}
    >
      {children}
    </IconButton>
  </Tooltip>
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
    <Box
      ref={boxRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      sx={{
        position: "absolute",
        zIndex: 2,
        width: { xs: 104, sm: 200 },
        aspectRatio: { xs: "3 / 4", sm: "4 / 3" },
        borderRadius: "14px",
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.15)",
        touchAction: "none",
        cursor: "grab",
        ...(pos ? { left: pos.x, top: pos.y } : { right: 16, top: { xs: 72, sm: 80 } }),
      }}
    >
      <StreamVideo
        stream={stream}
        mirrored={mirrored}
        label="Your camera"
        sx={{ width: "100%", height: "100%" }}
      />
    </Box>
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
  const live = LIVE_PHASES.has(phase);
  const outgoing = phase === "preparing" || phase === "calling" || phase === "ringing";
  const showRemoteVideo = live && peerCamOn && remoteStream;
  // While ringing out on a video call, your own camera fills the screen.
  const showLocalFull = outgoing && camOn && localStream;
  const showSelfView = live && camOn && localStream;
  const notice = noticeLabel(call.notice);

  // Notices are informational; fade them after a few seconds.
  useEffect(() => {
    if (!call.notice) return;
    const id = setTimeout(clearNotice, 5000);
    return () => clearTimeout(id);
  }, [call.notice]);

  let status = phaseLabel(call);
  if (phase === "active" && call.connectedAt) status = <Timer since={call.connectedAt} />;
  if (phase === "ended") status = endReasonLabel(call.endReason, peer?.fullName);

  return (
    <Box
      role="dialog"
      aria-label={`${kindLabel(kind)} with ${peer?.fullName ?? ""}`}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        bgcolor: "#05060a",
        color: "white",
        display: "flex",
        flexDirection: "column",
        pt: "env(safe-area-inset-top)",
        pb: "env(safe-area-inset-bottom)",
        overflow: "hidden",
      }}
    >
      {live && <StreamAudio stream={remoteStream} version={remoteVersion} />}

      {showRemoteVideo && (
        <StreamVideo
          stream={remoteStream}
          version={remoteVersion}
          label={`${peer.fullName}'s camera`}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: { xs: "cover", sm: "contain" },
          }}
        />
      )}
      {showLocalFull && (
        <StreamVideo
          stream={localStream}
          mirrored={facingMode === "user"}
          label="Your camera"
          sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.55 }}
        />
      )}

      {/* Top bar */}
      <Box
        sx={{
          position: "relative",
          zIndex: 3,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1.5,
          background: "linear-gradient(rgba(0,0,0,0.55), transparent)",
        }}
      >
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          {kindLabel(kind)}
        </Typography>
        {phase === "active" && <QualityBars quality={quality} />}
        <Box sx={{ flex: 1 }} />
        {showRemoteVideo && (
          <Typography variant="body2" fontWeight={600} sx={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
            {peer.fullName} · {status}
          </Typography>
        )}
      </Box>

      {/* Banners */}
      <Box
        sx={{
          position: "relative",
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          px: 2,
        }}
      >
        {(peerReconnecting || phase === "reconnecting") && (
          <Banner>
            {peerReconnecting
              ? `${peer.fullName}'s connection is unstable…`
              : "Your connection is unstable. Reconnecting…"}
          </Banner>
        )}
        {live && !peerMicOn && <Banner>{peer.fullName} is muted</Banner>}
        {notice && <Banner>{notice}</Banner>}
      </Box>

      {/* Centre: who you're talking to, when there's no video to show */}
      {!showRemoteVideo && (
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1.5,
            px: 3,
            textAlign: "center",
          }}
        >
          {phase === "error" ? (
            <ErrorPanel code={call.error} />
          ) : (
            <>
              <Avatar
                src={peer?.profilePic}
                sx={{
                  width: { xs: 112, sm: 136 },
                  height: { xs: 112, sm: 136 },
                  boxShadow: "0 0 0 6px rgba(255,255,255,0.06)",
                }}
              />
              <Typography variant="h5" fontWeight={600}>
                {peer?.fullName}
              </Typography>
              <Typography variant="body1" aria-live="polite" sx={{ opacity: 0.8, minHeight: 24 }}>
                {phase === "failed" ? failureLabel(call.failure) : status}
              </Typography>
              {live && kind === "video" && !peerCamOn && phase === "active" && (
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  {peer?.fullName}&apos;s camera is off
                </Typography>
              )}
            </>
          )}
        </Box>
      )}
      {showRemoteVideo && <Box sx={{ flex: 1 }} />}

      {showSelfView && <SelfView stream={localStream} mirrored={facingMode === "user"} />}

      {/* Controls */}
      <Box
        sx={{
          position: "relative",
          zIndex: 3,
          display: "flex",
          justifyContent: "center",
          gap: { xs: 2, sm: 3 },
          py: 3,
          background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
        }}
      >
        {phase === "failed" || phase === "error" ? (
          <>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<Close />}
              onClick={dismissCall}
              sx={{ borderColor: "rgba(255,255,255,0.3)", color: "white", background: "none" }}
            >
              Close
            </Button>
            <Button variant="contained" startIcon={<Refresh />} onClick={retryCall}>
              Try again
            </Button>
          </>
        ) : phase === "ended" ? (
          <Box sx={{ height: 60 }} />
        ) : (
          <>
            <ControlButton label={micOn ? "Mute" : "Unmute"} active={micOn} onClick={toggleMic}>
              {micOn ? <MicNoneOutlined sx={{ fontSize: 24 }} /> : <MicOffOutlined sx={{ fontSize: 24 }} />}
            </ControlButton>
            <ControlButton
              label={camOn ? "Turn camera off" : "Turn camera on"}
              active={camOn}
              onClick={toggleCamera}
            >
              {camOn ? (
                <VideocamOutlined sx={{ fontSize: 24 }} />
              ) : (
                <VideocamOffOutlined sx={{ fontSize: 24 }} />
              )}
            </ControlButton>
            {camOn && canFlipCamera && (
              <ControlButton label="Switch camera" onClick={flipCamera}>
                <CameraswitchOutlined sx={{ fontSize: 22 }} />
              </ControlButton>
            )}
            <ControlButton label={outgoing ? "Cancel call" : "End call"} danger onClick={hangUp}>
              <CallEnd sx={{ fontSize: 26 }} />
            </ControlButton>
          </>
        )}
      </Box>
    </Box>
  );
};

const Banner = ({ children }) => (
  <Box
    role="status"
    sx={{
      px: 2,
      py: 0.75,
      borderRadius: "999px",
      bgcolor: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(6px)",
      fontSize: "0.8rem",
    }}
  >
    {children}
  </Box>
);

const ErrorPanel = ({ code }) => {
  const { title, body } = errorHelp(code);
  return (
    <Box sx={{ maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          bgcolor: "rgba(229,72,77,0.15)",
          color: "#ff6b70",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <WarningAmberOutlined sx={{ fontSize: 30 }} />
      </Box>
      <Typography variant="h6" fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.8, lineHeight: 1.6 }}>
        {body}
      </Typography>
    </Box>
  );
};

export default CallScreen;

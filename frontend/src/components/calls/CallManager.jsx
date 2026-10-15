import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Box, Button, Typography } from "@mui/material";
import { FiPhone } from "react-icons/fi";
import { useSocketContext } from "../../context/SocketContext";
import { useCallStore } from "../../calls/callStore";
import { attachCallEngine, rejoinCall, leaveResumableCall } from "../../calls/callEngine";
import IncomingCall from "./IncomingCall";
import CallScreen from "./CallScreen";

// While a call rings in a background tab, make it visible: flash the title
// and, if the user has allowed it, show a system notification.
const useBackgroundRingAlert = (call) => {
  const ringing = call?.phase === "incoming";
  const callId = call?.callId;
  const name = call?.peer?.fullName;
  const kind = call?.kind;

  useEffect(() => {
    if (!ringing) return;
    const original = document.title;
    const label = `📞 ${name} is calling…`;
    let on = false;
    const flash = setInterval(() => {
      on = !on;
      document.title = on ? label : original;
    }, 1000);

    let notification = null;
    if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
      try {
        notification = new Notification(`Incoming ${kind === "video" ? "video" : "voice"} call`, {
          body: name,
          tag: `call-${callId}`,
          requireInteraction: true,
          silent: false,
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch {
        notification = null;
      }
    }

    return () => {
      clearInterval(flash);
      document.title = original;
      notification?.close();
    };
  }, [ringing, callId, name, kind]);
};

const ResumeBanner = () => (
  <Box
    role="alert"
    sx={{
      position: "fixed", zIndex: 1300, left: "50%", transform: "translateX(-50%)",
      bottom: "calc(env(safe-area-inset-bottom) + 16px)",
      display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.25,
      borderRadius: "16px", bgcolor: "#12152a", border: "1px solid rgba(255,255,255,0.12)",
      boxShadow: "0 12px 32px rgba(0,0,0,0.5)", width: { xs: "calc(100% - 32px)", sm: "auto" }, maxWidth: 520,
    }}
  >
    <FiPhone />
    <Typography variant="body2" sx={{ flex: "1 1 auto", minWidth: 0 }}>You left a call that’s still going.</Typography>
    <Button size="small" onClick={leaveResumableCall} sx={{ color: "text.secondary", background: "none", px: 1.5, py: 0.5 }}>Leave</Button>
    <Button size="small" variant="contained" onClick={rejoinCall} sx={{ px: 2, py: 0.5 }}>Rejoin</Button>
  </Box>
);

/** Mounted once for a logged-in user: wires calls to the socket and shows call UI. */
const CallManager = () => {
  const { socket } = useSocketContext();
  const queryClient = useQueryClient();
  const call = useCallStore((s) => s.call);
  const resumable = useCallStore((s) => s.resumable);

  useEffect(() => {
    if (!socket) return;
    return attachCallEngine(socket, {
      // Names and avatars for a call rejoined after a reload, from the
      // contact list the sidebar has already loaded.
      peerResolver: (id) =>
        queryClient.getQueryData(["conversations"])?.find?.((c) => c._id === id) ?? { _id: id, fullName: "Contact", profilePic: "" },
    });
  }, [socket, queryClient]);

  useBackgroundRingAlert(call);

  return (
    <>
      {call?.phase === "incoming" && <IncomingCall call={call} />}
      {call && call.phase !== "incoming" && <CallScreen call={call} />}
      {resumable && !call && <ResumeBanner />}
    </>
  );
};

export default CallManager;

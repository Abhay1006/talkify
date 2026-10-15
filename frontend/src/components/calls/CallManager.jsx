import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketContext } from "../../context/SocketContext";
import { useCallStore } from "../../calls/callStore";
import { attachCallEngine, rejoinCall, leaveResumableCall } from "../../calls/callEngine";
import IncomingCall from "./IncomingCall";
import { conversationsQueryKey } from "../../queries/conversations";
import CallScreen from "./CallScreen";

// While a call rings in a background tab, make it visible: flash the title
// and, if the user has allowed it, show a system notification.
const useBackgroundRingAlert = (call) => {
  const ringing = call?.phase === "incoming";
  const callId = call?.callId;
  const name = call?.peer?.username ?? call?.peer?.fullName;
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
    if (
      document.visibilityState === "hidden" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
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
  <div className="banner is-bottom" role="alert">
    <span className="banner-text">You left a call that’s still going.</span>
    <button type="button" className="btn" onClick={leaveResumableCall}>
      Leave
    </button>
    <button type="button" className="btn btn-primary" onClick={rejoinCall}>
      Rejoin
    </button>
  </div>
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
        queryClient.getQueryData(conversationsQueryKey)?.find?.((c) => c._id === id) ?? {
          _id: id,
          fullName: "Contact",
          profilePic: "",
        },
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

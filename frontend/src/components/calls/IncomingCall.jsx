import { acceptCall, declineCall } from "../../calls/callEngine";
import Dialog from "../ui/Dialog";

const IncomingCall = ({ call }) => {
  const { peer, kind } = call;
  const name = peer.username ?? peer.fullName;
  const kindText = kind === "video" ? "video" : "voice";

  return (
    <Dialog
      open
      dismissible={false}
      role="alertdialog"
      label={`Incoming ${kindText} call from ${name}`}
      className="incoming-call"
    >
      <div className="incoming-call-kind">Incoming {kindText} call</div>
      <div className="incoming-call-name">{name}</div>
      {peer.fullName && peer.username && <div className="text-muted">{peer.fullName}</div>}
      <div className="incoming-call-actions">
        <button type="button" className="btn btn-danger" onClick={declineCall}>
          Decline
        </button>
        {kind === "video" && (
          <button type="button" className="btn" onClick={() => acceptCall({ video: false })}>
            Audio only
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => acceptCall({ video: kind === "video" })}
          autoFocus
        >
          Accept
        </button>
      </div>
    </Dialog>
  );
};

export default IncomingCall;

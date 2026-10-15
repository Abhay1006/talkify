import { Avatar, Box, Dialog, IconButton, Typography } from "@mui/material";
import { CallOutlined, CallEnd, VideocamOutlined } from "@mui/icons-material";
import { acceptCall, declineCall } from "../../calls/callEngine";

const RoundButton = ({ label, color, onClick, children }) => (
  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75 }}>
    <IconButton
      onClick={onClick}
      aria-label={label}
      sx={{
        width: 60,
        height: 60,
        bgcolor: color,
        color: "white",
        "&:hover": { bgcolor: color, filter: "brightness(1.1)" },
      }}
    >
      {children}
    </IconButton>
    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.75)" }}>
      {label}
    </Typography>
  </Box>
);

const IncomingCall = ({ call }) => {
  const { peer, kind } = call;
  return (
    <Dialog
      open
      onClose={() => {}}
      slotProps={{
        paper: {
          role: "alertdialog",
          "aria-label": `Incoming ${kind === "video" ? "video" : "voice"} call from ${peer.fullName}`,
          sx: {
            bgcolor: "#12152a",
            backdropFilter: "none",
            backgroundImage: "none",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "24px",
            p: { xs: 3, sm: 4 },
            width: 340,
            maxWidth: "calc(100% - 32px)",
          },
        },
      }}
    >
      <Box
        sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 1 }}
      >
        <Avatar
          src={peer.profilePic}
          sx={{
            width: 88,
            height: 88,
            mb: 1,
            boxShadow: "0 0 0 0 rgba(108,99,255,0.6)",
            animation: "callPulse 1.6s infinite",
            "@keyframes callPulse": {
              "0%": { boxShadow: "0 0 0 0 rgba(108,99,255,0.6)" },
              "70%": { boxShadow: "0 0 0 18px rgba(108,99,255,0)" },
              "100%": { boxShadow: "0 0 0 0 rgba(108,99,255,0)" },
            },
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        />
        <Typography variant="h6" fontWeight={600} sx={{ color: "white" }}>
          {peer.fullName}
        </Typography>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mb: 2 }}>
          Incoming {kind === "video" ? "video" : "voice"} call
        </Typography>
        <Box sx={{ display: "flex", gap: 3, justifyContent: "center" }}>
          <RoundButton label="Decline" color="#e5484d" onClick={declineCall}>
            <CallEnd sx={{ fontSize: 26 }} />
          </RoundButton>
          {kind === "video" ? (
            <>
              <RoundButton label="Audio only" color="#3b3f5c" onClick={() => acceptCall({ video: false })}>
                <CallOutlined sx={{ fontSize: 24 }} />
              </RoundButton>
              <RoundButton label="Accept" color="#30a46c" onClick={() => acceptCall({ video: true })}>
                <VideocamOutlined sx={{ fontSize: 26 }} />
              </RoundButton>
            </>
          ) : (
            <RoundButton label="Accept" color="#30a46c" onClick={() => acceptCall({ video: false })}>
              <CallOutlined sx={{ fontSize: 26 }} />
            </RoundButton>
          )}
        </Box>
      </Box>
    </Dialog>
  );
};

export default IncomingCall;

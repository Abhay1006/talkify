import { Box, Button, Typography } from "@mui/material";
import { usePwaStore, applyUpdate } from "../pwa";

// A new version was deployed and its service worker is waiting. Reloading
// is the user's call: it would interrupt a call or a half-typed message.
const PwaUpdatePrompt = () => {
  const updateReady = usePwaStore((s) => s.updateReady);
  if (!updateReady) return null;
  return (
    <Box role="status" sx={{
      position: "fixed", zIndex: 1250, top: "calc(env(safe-area-inset-top) + 12px)", left: "50%", transform: "translateX(-50%)",
      display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1, borderRadius: "14px",
      bgcolor: "#12152a", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
      width: { xs: "calc(100% - 32px)", sm: "auto" },
    }}>
      <Typography variant="body2" sx={{ flex: 1 }}>A new version of Talkify is available.</Typography>
      <Button size="small" variant="contained" onClick={applyUpdate} sx={{ py: 0.5, px: 2 }}>Update</Button>
    </Box>
  );
};

export default PwaUpdatePrompt;

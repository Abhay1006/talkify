import { useState } from "react";
import useLogout from "../../hooks/useLogout";
import { useAuthContext } from "../../context/AuthContext";
import { Box, Typography, IconButton, Avatar, CircularProgress, ButtonBase, Tooltip } from "@mui/material";
import ProfileDialog from "../profile/ProfileDialog";
import { Logout } from "@mui/icons-material";

const LogoutButton = () => {
  const { logout, loading } = useLogout();
  const { authUser } = useAuthContext();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
      <ButtonBase
        onClick={() => setProfileOpen(true)}
        aria-label="Open your profile"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 1.5,
          minWidth: 0,
          flex: 1,
          borderRadius: "12px",
          p: 0.5,
          mr: 1,
          textAlign: "left",
          "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
          "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.light" },
        }}
      >
        <Avatar
          src={authUser.profilePic}
          alt=""
          variant="rounded"
          sx={{
            width: { xs: 36, sm: 40 },
            height: { xs: 36, sm: 40 },
            border: "1px solid rgba(255,255,255,0.1)",
            flexShrink: 0,
          }}
        />
        <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Typography
            variant="body2"
            fontWeight={600}
            color="text.primary"
            noWrap
            sx={{ fontSize: { xs: "0.8rem", sm: "0.875rem" } }}
          >
            {authUser.fullName}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>
            Profile &amp; settings
          </Typography>
        </Box>
      </ButtonBase>

      <Tooltip title="Log out">
        <IconButton
          aria-label="Log out"
          onClick={logout}
          disabled={loading}
          color="error"
          sx={{
            bgcolor: "rgba(255, 255, 255, 0.05)",
            "&:hover": { bgcolor: "error.dark" },
            minWidth: 44,
            minHeight: 44,
            flexShrink: 0,
          }}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : <Logout sx={{ fontSize: 18 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default LogoutButton;

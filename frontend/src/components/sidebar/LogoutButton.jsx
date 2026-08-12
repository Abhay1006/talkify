import { FiLogOut } from "react-icons/fi";
import useLogout from "../../hooks/useLogout";
import { useAuthContext } from "../../context/AuthContext";
import { Box, Typography, IconButton, Avatar, CircularProgress } from "@mui/material";

const LogoutButton = () => {
  const { logout, loading } = useLogout();
  const { authUser } = useAuthContext();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
        <Avatar src={authUser.profilePic} variant="rounded" sx={{ width: { xs: 36, sm: 40 }, height: { xs: 36, sm: 40 }, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} color="text.primary" noWrap sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
            {authUser.fullName}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            Talkify User
          </Typography>
        </Box>
      </Box>
      
      <IconButton 
        onClick={logout}
        disabled={loading}
        color="error"
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.05)',
          '&:hover': { bgcolor: 'error.dark' },
          minWidth: 44,
          minHeight: 44,
          flexShrink: 0,
        }}
      >
        {loading ? <CircularProgress size={20} color="inherit" /> : <FiLogOut size={18} />}
      </IconButton>
    </Box>
  );
};

export default LogoutButton;

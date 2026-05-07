import { FiLogOut } from "react-icons/fi";
import useLogout from "../../hooks/useLogout";
import { useAuthContext } from "../../context/AuthContext";
import { Box, Typography, IconButton, Avatar, CircularProgress } from "@mui/material";

const LogoutButton = () => {
  const { logout, loading } = useLogout();
  const { authUser } = useAuthContext();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar src={authUser.profilePic} variant="rounded" sx={{ width: 40, height: 40, border: '1px solid rgba(255,255,255,0.1)' }} />
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ maxWidth: 100 }} noWrap>
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
        sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', '&:hover': { bgcolor: 'error.dark' } }}
      >
        {loading ? <CircularProgress size={20} color="inherit" /> : <FiLogOut size={20} />}
      </IconButton>
    </Box>
  );
};

export default LogoutButton;

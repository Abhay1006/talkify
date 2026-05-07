import { Box, Typography } from "@mui/material";
import Conversations from "./Conversations";
import LogoutButton from "./LogoutButton";
import SearchInput from "./SearchInput";

const Sidebar = () => {
  return (
    <Box sx={{
      width: 320,
      borderRight: '1px solid rgba(255, 255, 255, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      bgcolor: 'rgba(255, 255, 255, 0.02)',
    }}>
        <Box sx={{ p: 3, pb: 1 }}>
          <SearchInput/>
        </Box>
        <Box sx={{ px: 3, py: 2, flex: 1, overflowY: 'auto' }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, px: 1, mb: 2, display: 'block' }}>
            Recent Conversations
          </Typography>
          <Conversations/>
        </Box>
        <Box sx={{ p: 3, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <LogoutButton/>
        </Box>
    </Box>
  )
}

export default Sidebar;
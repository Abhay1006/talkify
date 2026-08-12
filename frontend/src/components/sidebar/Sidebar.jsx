import { Box, Typography } from "@mui/material";
import Conversations from "./Conversations";
import LogoutButton from "./LogoutButton";
import SearchInput from "./SearchInput";

const Sidebar = () => {
  return (
    <Box sx={{
      width: '100%',
      borderRight: { xs: 'none', md: '1px solid rgba(255, 255, 255, 0.05)' },
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      bgcolor: 'rgba(255, 255, 255, 0.02)',
    }}>
        <Box sx={{ p: { xs: 2, sm: 3 }, pb: 1 }}>
          <SearchInput/>
        </Box>
        <Box sx={{
          px: { xs: 1.5, sm: 3 },
          py: { xs: 1, sm: 2 },
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, px: 1, mb: { xs: 1, sm: 2 }, display: 'block', fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
            Recent Conversations
          </Typography>
          <Conversations/>
        </Box>
        <Box sx={{
          p: { xs: 2, sm: 3 },
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          pb: { xs: 'calc(env(safe-area-inset-bottom, 8px) + 8px)', sm: 3 },
        }}>
          <LogoutButton/>
        </Box>
    </Box>
  )
}

export default Sidebar;
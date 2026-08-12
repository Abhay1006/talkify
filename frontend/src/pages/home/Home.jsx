import { Box } from "@mui/material";
import MessageContainer from "../../components/messages/MessageContainer";
import Sidebar from "../../components/sidebar/Sidebar";
import useConversation from "../../zustand/useConversations.js";

const Home = () => {
  const { selectedConversation } = useConversation();

  return (
    <Box sx={{
      display: 'flex',
      width: '100%',
      maxWidth: 1400,
      height: { xs: '100vh', sm: '90vh' },
      // Use dvh for mobile browsers that hide/show address bar
      '@supports (height: 100dvh)': {
        height: { xs: '100dvh', sm: '90dvh' },
      },
      bgcolor: 'rgba(11, 14, 26, 0.65)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: { xs: 0, sm: 4 },
      overflow: 'hidden',
      boxShadow: { xs: 'none', sm: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' },
      border: { xs: 'none', sm: '1px solid rgba(255, 255, 255, 0.08)' },
      position: 'relative',
    }}>
      {/* Sidebar — hidden on mobile when a conversation is selected */}
      <Box sx={{
        display: { xs: selectedConversation ? 'none' : 'flex', md: 'flex' },
        width: { xs: '100%', md: 320 },
        height: '100%',
        flexShrink: 0,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <Sidebar />
      </Box>

      {/* Message area — hidden on mobile when no conversation is selected */}
      <Box sx={{
        display: { xs: selectedConversation ? 'flex' : 'none', md: 'flex' },
        flex: 1,
        height: '100%',
        minWidth: 0, // Prevent flex overflow on mobile
      }}>
        <MessageContainer />
      </Box>
    </Box>
  );
};

export default Home;

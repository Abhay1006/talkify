import { Box } from "@mui/material";
import MessageContainer from "../../components/messages/MessageContainer";
import Sidebar from "../../components/sidebar/Sidebar";

const Home = () => {
  return (
    <Box sx={{
      display: 'flex',
      width: '100%',
      maxWidth: 1400,
      height: '90vh',
      bgcolor: 'rgba(11, 14, 26, 0.65)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 4,
      overflow: 'hidden',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
    }}>
      <Sidebar />
      <MessageContainer />
    </Box>
  );
};

export default Home;

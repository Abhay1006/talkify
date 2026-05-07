import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/home/Home";
import Login from "./pages/login/Login";
import Signup from "./pages/signup/Signup";
import { useAuthContext } from "./context/AuthContext";
import { Box } from "@mui/material";

function App() {
  const {authUser} = useAuthContext();

  return (
    <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', p: 2 }}>
      <Routes>
        <Route path="/" element={authUser?<Home />: <Navigate to={'/login'}/>}/>
        <Route path="/login" element={authUser ? <Navigate to='/' /> : <Login />} />
        <Route path="/signup" element={authUser ? <Navigate to='/' /> : <Signup />} />
      </Routes>
    </Box>
  );
}

export default App;

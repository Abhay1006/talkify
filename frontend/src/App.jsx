import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/home/Home";
import Login from "./pages/login/Login";
import Signup from "./pages/signup/Signup";
import { useAuthContext } from "./context/AuthContext";
import CallManager from "./components/calls/CallManager";
import PwaUpdatePrompt from "./components/PwaUpdatePrompt";

function App() {
  const { authUser, checkingSession } = useAuthContext();

  if (checkingSession) {
    return (
      <div className="empty" role="status">
        loading…
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={authUser ? <Home /> : <Navigate to="/login" />} />
        <Route path="/login" element={authUser ? <Navigate to="/" /> : <Login />} />
        <Route path="/signup" element={authUser ? <Navigate to="/" /> : <Signup />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {authUser && <CallManager />}
      <PwaUpdatePrompt />
    </>
  );
}

export default App;

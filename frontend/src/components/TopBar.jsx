import { useState } from "react";
import { useAuthContext } from "../context/AuthContext";
import { useSocketContext } from "../context/SocketContext";
import { useTheme } from "../context/ThemeContext";
import useLogout from "../hooks/useLogout";
import ProfileDialog from "./profile/ProfileDialog";

// Reflects the real socket state, so a dropped connection is visible without
// opening anything. Nothing is shown while connected.
const CONNECTION = {
  connecting: "connecting…",
  disconnected: "offline",
};

const TopBar = () => {
  const { authUser } = useAuthContext();
  const { status } = useSocketContext();
  const { isDark, toggle } = useTheme();
  const { logout, loading } = useLogout();
  const [profileOpen, setProfileOpen] = useState(false);
  const connection = status === "connected" ? null : (CONNECTION[status] ?? CONNECTION.disconnected);

  return (
    <header className="topbar">
      <span className="topbar-brand">talkify</span>
      <div className="topbar-right">
        {connection && (
          <span className="topbar-status" role="status">
            {connection}
          </span>
        )}
        <button
          type="button"
          className="btn-link topbar-user"
          onClick={() => setProfileOpen(true)}
          title="Profile and settings"
        >
          {authUser.username}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={toggle}
          title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        >
          {isDark ? "☀" : "☾"}
        </button>
        <button type="button" className="btn-link" onClick={logout} disabled={loading}>
          {loading ? "…" : "logout"}
        </button>
      </div>
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
    </header>
  );
};

export default TopBar;

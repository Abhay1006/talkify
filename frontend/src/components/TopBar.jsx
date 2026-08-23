import { useAuthContext } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import useLogout from "../hooks/useLogout";

const TopBar = () => {
  const { authUser } = useAuthContext();
  const { isDark, toggle } = useTheme();
  const { logout, loading } = useLogout();

  return (
    <header className="topbar">
      <span className="topbar-brand">talkify</span>
      <div className="topbar-right">
        <span className="topbar-user">{authUser.username}</span>
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
    </header>
  );
};

export default TopBar;

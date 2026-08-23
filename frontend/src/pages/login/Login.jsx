import { useState } from "react";
import { Link } from "react-router-dom";
import useLogin from "../../hooks/useLogin";

const Login = () => {
  const { loading, login } = useLogin();
  const [values, setValues] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const change = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!values.username.trim() || !values.password) {
      setError("Username and password are required.");
      return;
    }
    setError("");
    await login(values.username.trim(), values.password);
  };

  return (
    <main className="auth">
      <div className="auth-card">
        <h1 className="auth-brand">talkify</h1>
        <p className="auth-sub">Sign in to continue.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              className="input"
              value={values.username}
              onChange={change}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              className="input"
              type="password"
              value={values.password}
              onChange={change}
              autoComplete="current-password"
            />
          </div>

          {error && <div className="field-error">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-foot">
          No account? <Link to="/signup">Register</Link>
        </p>
      </div>
    </main>
  );
};

export default Login;

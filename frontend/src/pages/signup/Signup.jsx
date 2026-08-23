import { useState } from "react";
import { Link } from "react-router-dom";
import useSignup from "../../hooks/useSignup";

const initial = {
  fullName: "",
  username: "",
  password: "",
  confirmPassword: "",
  gender: "male",
};

// Mirrors what the API enforces, so a bad form never costs a round trip.
const validate = ({ fullName, username, password, confirmPassword }) => {
  if (!fullName.trim()) return "Full name is required.";
  if (!username.trim()) return "Username is required.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return "";
};

const Signup = () => {
  const [loading, signup] = useSignup();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");

  const change = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const message = validate(values);
    setError(message);
    if (message) return;
    await signup({ ...values, fullName: values.fullName.trim(), username: values.username.trim() });
  };

  return (
    <main className="auth">
      <div className="auth-card">
        <h1 className="auth-brand">talkify</h1>
        <p className="auth-sub">Create an account.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              name="fullName"
              className="input"
              value={values.fullName}
              onChange={change}
              autoComplete="name"
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              className="input"
              value={values.username}
              onChange={change}
              autoComplete="username"
            />
          </div>

          <div className="auth-row">
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                className="input"
                type="password"
                value={values.password}
                onChange={change}
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                className="input"
                type="password"
                value={values.confirmPassword}
                onChange={change}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="field">
            <label>Gender</label>
            <div className="radio-row">
              <label htmlFor="gender-male">
                <input
                  id="gender-male"
                  type="radio"
                  name="gender"
                  value="male"
                  checked={values.gender === "male"}
                  onChange={change}
                />
                male
              </label>
              <label htmlFor="gender-female">
                <input
                  id="gender-female"
                  type="radio"
                  name="gender"
                  value="female"
                  checked={values.gender === "female"}
                  onChange={change}
                />
                female
              </label>
            </div>
          </div>

          {error && <div className="field-error">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="auth-foot">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
};

export default Signup;

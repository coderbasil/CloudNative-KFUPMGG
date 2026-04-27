import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../pages-css/Login.css";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const redirectByRole = (role) => {
    if (role === "admin") navigate("/admin");
    else if (role === "photographer") navigate("/photographer");
    else navigate("/gamepage");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return setMessage({ type: "error", text: data.message || "Error logging in" });
      localStorage.setItem("kfupm_user", JSON.stringify({ role: data.role, email }));
      redirectByRole(data.role);
    } catch {
      setMessage({ type: "error", text: "Network error, please try again" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return setMessage({ type: "error", text: data.message || "Error creating account" });
      localStorage.setItem("kfupm_user", JSON.stringify({ role: data.role || "player", email }));
      redirectByRole(data.role || "player");
    } catch {
      setMessage({ type: "error", text: "Network error, please try again" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form">
        <img src="/assets/kfupm-logo.png" alt="KFUPM Logo" className="login-logo" />
        <h2>KFUPM GeoGuesser</h2>
        <p className="login-subtitle">Sign in to start playing</p>

        <label>Email</label>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label>Password</label>
        <input
          type="password"
          placeholder="Min. 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {message && (
          <p className={`auth-message ${message.type}`}>{message.text}</p>
        )}

        <div className="button-group">
          <button
            type="button"
            className="btn-primary"
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? "Please wait…" : "Login"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleRegister}
            disabled={isLoading}
          >
            Create Account
          </button>
        </div>

        <div className="back-link">
          <Link to="/">← Back to Home</Link>
        </div>
      </form>
    </div>
  );
}

export default Login;

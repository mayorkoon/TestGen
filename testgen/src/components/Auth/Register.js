import React, { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../../firebase";
import { Link } from "react-router-dom";
import "./Auth.css";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("Email already in use.");
      } else {
        setError("Registration failed. Please try again.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-bg-glow"></div>
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo__icon">⚡</span>
          <span className="auth-logo__text">TestGen</span>
        </div>
        <p className="auth-subtitle">Create your account</p>

        <form onSubmit={handleRegister} className="auth-form">
          <div className="auth-field">
            <label className="auth-label">Full Name</label>
            <input
              type="text"
              placeholder="Abiodun Adeyemi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="auth-input"
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Confirm Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="auth-input"
              required
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <span className="auth-btn__spinner"></span> : "Create Account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <Link to="/login" className="auth-switch__link">Sign In</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;

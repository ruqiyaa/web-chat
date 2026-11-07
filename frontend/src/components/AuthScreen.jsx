import { use, useState } from "react";
import { api } from "../api";
import logo from "../assets/raabta-logo.png";

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  function switchMode() {
    setMode(isRegister ? "login" : "register");
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = isRegister
        ? await api("/api/register", {
            method: "POST",
            body: { username, display_name: displayName, password },
          })
        : await api("/api/login", {
            method: "POST",
            body: { username, password, remember },
          });
      if (res.ok) onAuth(res.data.user);
      else setError(res.data?.error || "Something went wrong");
    } catch {
      setError("Could not reach server. Is it running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="join">
      <form className="join-card" onSubmit={submit}>
        <div className="brand">
          <img src={logo} alt="" className="brand-logo" />
          <h1 className="wordmark">Raabta</h1>
          <p className="tagline">Your people. Your vibe.</p>
        </div>

        <h2 className="auth-title">
          {isRegister ? "Create your account" : "Welcome back!"}
        </h2>

        <label className="field">
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            maxLength={20}
            required
          />
        </label>

        {isRegister && (
          <label className="field">
            <span>Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={30}
              required
            />
          </label>
        )}

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            maxLength={128}
            required
          />
        </label>

        {!isRegister && (
          <label className="check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Remember me</span>
          </label>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Please wait..." : isRegister ? "Sign up" : "Log in"}
        </button>

        <p className="switch">
          {isRegister ? "Already have an account?" : "New to Raabta?"}{" "}
          <button type="button" className="link" onClick={switchMode}>
            {isRegister ? "Log in" : "Sign up"}
          </button>
        </p>
      </form>
    </div>
  );
}

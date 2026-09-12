import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { PostCard, type Post } from "../../components/PostCard";

export function LoginPage() {
  const { boot, refresh } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "signup" ? "signup" : "login");
  const [err, setErr] = useState("");
  const [twofa, setTwofa] = useState(false);
  const [code, setCode] = useState("");
  const ref = params.get("ref") || "";

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
      });
      if (data.twofa) { setTwofa(true); return; }
      await refresh();
      nav("/");
    } catch (ex) { setErr((ex as Error).message); }
  }
  async function register(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          displayName: fd.get("displayName"),
          username: fd.get("username"),
          email: fd.get("email"),
          password: fd.get("password"),
          confirmPassword: fd.get("confirmPassword"),
          ref: fd.get("ref") || ref,
        }),
      });
      await refresh();
      nav("/");
    } catch (ex) { setErr((ex as Error).message); }
  }

  if (twofa) {
    return (
      <div className="auth-wrap">
        <div className="auth-card twofa-card">
          <h2>Two-factor</h2>
          <input className="otp-input" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn btn-primary" onClick={async () => {
            await api("/api/auth/2fa/verify", { method: "POST", body: JSON.stringify({ token: code }) });
            await refresh(); nav("/");
          }}>Verify</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-art">
        <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
        <img className="brand-logo auth-logo" src="/icons/favicon.svg" width={96} height={96} alt="" />
        <h1>{boot?.appName || "DUYS"}</h1>
        <p>Post. Connect. Broadcast. Earn $DUYS.</p>
      </div>
      <div className="auth-card">
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === "login" ? "active" : ""}`} onClick={() => setTab("login")}>Log in</button>
          <button className={`auth-tab ${tab === "signup" ? "active" : ""}`} onClick={() => setTab("signup")}>Sign up</button>
          <span className={`auth-tab-slider ${tab === "signup" ? "right" : ""}`} />
        </div>
        {err && <div className="flash flash-error">{err}</div>}
        {boot?.googleEnabled && (
          <>
            <button className="btn btn-google btn-block" onClick={async () => {
              const { url } = await api("/api/auth/google");
              window.location.href = url;
            }}>Continue with Google</button>
            <div className="auth-or"><span>or</span></div>
          </>
        )}
        {tab === "login" ? (
          <form className="auth-form" onSubmit={login}>
            <div className="field"><label>Email or username</label><input name="email" required /></div>
            <div className="field"><label>Password</label><input name="password" type="password" required /></div>
            <button className="btn btn-primary btn-block">Log in</button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={register}>
            <div className="field-row">
              <div className="field"><label>Name</label><input name="displayName" required /></div>
              <div className="field"><label>Username</label><input name="username" required minLength={3} /></div>
            </div>
            <div className="field"><label>Email</label><input name="email" type="email" required /></div>
            <div className="field"><label>Password</label><input name="password" type="password" minLength={8} required /></div>
            <div className="field"><label>Confirm</label><input name="confirmPassword" type="password" required /></div>
            <div className="field"><label>Referral</label><input name="ref" defaultValue={ref} /></div>
            <label className="checkbox-label"><input type="checkbox" required /> Agree to <Link to="/legal/terms">Terms</Link></label>
            <button className="btn btn-primary btn-block">Create account</button>
          </form>
        )}
      </div>
    </div>
  );
}

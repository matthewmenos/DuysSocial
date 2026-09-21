import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Icon } from "../../components/Icon";
import { PageLoading } from "../../components/PageState";

type Me = {
  displayName: string;
  username: string;
  bio: string;
  location: string;
  website: string;
  avatarUrl: string;
  verifiedBadge: string;
  twofaEnabled: boolean;
  whoCanDm: string;
  showOnline: boolean;
  showLastSeen: boolean;
  ringtoneUrl: string;
  theme: string;
};

/** Mirrors DUYS/duys/templates/profile/settings.html — same classes, so the ported styles apply. */
export function SettingsPage() {
  const { boot, refresh, setTheme } = useAuth();
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [flash, setFlash] = useState<{ kind: string; text: string } | null>(null);
  const [usernameHint, setUsernameHint] = useState("");
  const [twofa, setTwofa] = useState<{ secret: string; qr: string } | null>(null);
  const [twofaCode, setTwofaCode] = useState("");
  const ringInput = useRef<HTMLInputElement>(null);
  const ringAudio = useRef<HTMLAudioElement | null>(null);

  const load = () => api("/api/settings").then((d) => setMe(d.user));
  useEffect(() => { load(); }, []);
  useEffect(() => () => { ringAudio.current?.pause(); }, []);

  const say = (kind: "success" | "error", text: string) => setFlash({ kind, text });

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      // Username is part of the same form in the original; only POST it when changed.
      const newUsername = String(fd.get("username") || "").trim().replace(/^@/, "").toLowerCase();
      if (newUsername && me && newUsername !== me.username) {
        const d = await api("/api/settings/username", { method: "POST", body: JSON.stringify({ username: newUsername }) });
        setMe(d.user);
      }
      await api("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          displayName: String(fd.get("displayName") || ""),
          bio: String(fd.get("bio") || ""),
          location: String(fd.get("location") || ""),
          website: String(fd.get("website") || ""),
        }),
      });
      await load();
      await refresh();
      say("success", "Profile updated.");
    } catch (ex) {
      say("error", (ex as Error).message);
    }
  }

  async function checkUsername(value: string) {
    if (!value) return setUsernameHint("");
    try {
      const r = await api(`/api/auth/check-username?username=${encodeURIComponent(value)}`);
      setUsernameHint(r.available ? `@${value} is available` : "That username is taken or invalid.");
    } catch {
      setUsernameHint("");
    }
  }

  async function saveMessaging(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          whoCanDm: String(fd.get("whoCanDm") || "everyone"),
          showOnline: fd.get("showOnline") === "on",
          showLastSeen: fd.get("showLastSeen") === "on",
        }),
      });
      await load();
      say("success", "Messaging preferences saved.");
    } catch (ex) {
      say("error", (ex as Error).message);
    }
  }

  async function start2fa() {
    try {
      const d = await api("/api/auth/2fa/setup");
      setTwofa({ secret: d.secret, qr: d.qr });
    } catch (ex) {
      say("error", (ex as Error).message);
    }
  }

  async function confirm2fa(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!twofa) return;
    try {
      await api("/api/auth/2fa/enable", { method: "POST", body: JSON.stringify({ secret: twofa.secret, token: twofaCode }) });
      setTwofa(null);
      setTwofaCode("");
      await load();
      say("success", "Two-factor authentication enabled.");
    } catch (ex) {
      say("error", (ex as Error).message);
    }
  }

  async function disable2fa() {
    try {
      await api("/api/auth/2fa/disable", { method: "POST", body: "{}" });
      await load();
      say("success", "Two-factor authentication disabled.");
    } catch (ex) {
      say("error", (ex as Error).message);
    }
  }

  async function enablePush() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Push notifications are not supported in this browser.");
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: boot?.vapidPublic });
      await api("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub.toJSON()) });
      say("success", "Push notifications enabled.");
    } catch (ex) {
      say("error", (ex as Error).message);
    }
  }

  async function uploadRingtone(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const d = await api("/api/settings/ringtone", { method: "POST", body: fd });
      setMe(d.user);
      say("success", "Ringtone uploaded.");
    } catch (ex) {
      say("error", (ex as Error).message);
    }
  }

  function previewRingtone() {
    if (!me?.ringtoneUrl) return;
    ringAudio.current?.pause();
    const audio = new Audio(me.ringtoneUrl);
    ringAudio.current = audio;
    void audio.play().catch(() => {});
  }

  async function removeRingtone() {
    try {
      await api("/api/settings/ringtone", { method: "DELETE" });
      await load();
      say("success", "Ringtone removed.");
    } catch (ex) {
      say("error", (ex as Error).message);
    }
  }

  async function deleteAccount() {
    if (!window.confirm("This permanently deletes your account, posts and all media. This cannot be undone.")) return;
    await api("/api/settings/delete", { method: "POST", body: "{}" });
    await refresh();
    nav("/auth/login");
  }

  async function toggleTheme() {
    const next = me?.theme === "dark" ? "light" : "dark";
    setTheme(next);
    setMe((m) => (m ? { ...m, theme: next } : m));
    await api("/api/settings/theme", { method: "POST", body: JSON.stringify({ theme: next }) }).catch(() => {});
  }

  if (!me) return <PageLoading label="Loading settings…" />;

  return (
    <>
      <div className="page-head glass-bar">
        <button className="icon-btn" onClick={() => nav(-1)} title="Back"><Icon name="arrow-left" size={20} /></button>
        <h1>Settings</h1>
      </div>

      {flash && (
        <div className="flashes">
          <div className={`flash flash-${flash.kind}`}>
            <div className="flash-body">{flash.text}</div>
            <button className="flash-close" onClick={() => setFlash(null)}><Icon name="close" size={16} /></button>
          </div>
        </div>
      )}

      {/* ── Profile ── */}
      <div className="settings-card">
        <div className="settings-card-head">
          <div className="settings-section-label">Profile</div>
        </div>
        <form className="settings-form" onSubmit={saveProfile}>
          <div className="settings-field">
            <label className="settings-label" htmlFor="s-display-name">Display name</label>
            <input className="settings-input" type="text" id="s-display-name" name="displayName" defaultValue={me.displayName} maxLength={50} required />
          </div>
          <div className="settings-field">
            <label className="settings-label" htmlFor="s-username">Username</label>
            <div className="settings-input-wrap">
              <span className="settings-prefix">@</span>
              <input
                className="settings-input settings-input-prefixed"
                type="text"
                id="s-username"
                name="username"
                value={me.username}
                onChange={(e) => { setMe({ ...me, username: e.target.value }); checkUsername(e.target.value); }}
                autoComplete="username"
                maxLength={30}
              />
            </div>
            <span className="settings-hint">{usernameHint}</span>
          </div>
          <div className="settings-field">
            <label className="settings-label" htmlFor="s-bio">Bio</label>
            <textarea className="settings-input settings-textarea" id="s-bio" name="bio" rows={3} maxLength={200} defaultValue={me.bio} />
          </div>
          <div className="settings-field">
            <label className="settings-label" htmlFor="s-location">Location</label>
            <div className="settings-input-wrap">
              <span className="settings-icon"><Icon name="map-pin" size={16} /></span>
              <input className="settings-input settings-input-prefixed" type="text" id="s-location" name="location" defaultValue={me.location} placeholder="City, Country" />
            </div>
          </div>
          <div className="settings-field">
            <label className="settings-label" htmlFor="s-website">Website</label>
            <div className="settings-input-wrap">
              <span className="settings-icon"><Icon name="globe" size={16} /></span>
              <input className="settings-input settings-input-prefixed" type="url" id="s-website" name="website" defaultValue={me.website} placeholder="https://yoursite.com" />
            </div>
          </div>
          <button className="btn btn-primary settings-save-btn" type="submit">Save changes</button>
        </form>
      </div>

      {/* ── Security ── */}
      <div className="settings-card">
        <div className="settings-section-label">Security</div>
        <div className="settings-row">
          <div className="settings-row-info">
            <span className="settings-row-title">Two-Factor Authentication</span>
            <span className="settings-row-sub">Protect your account with a TOTP code.</span>
          </div>
          {me.twofaEnabled ? (
            <button className="btn btn-sm btn-danger" onClick={disable2fa}>Disable 2FA</button>
          ) : (
            <button className="btn btn-sm btn-primary" onClick={start2fa}>Enable 2FA</button>
          )}
        </div>
        {twofa && (
          <div className="settings-field">
            <p className="settings-row-sub">Scan with your authenticator app, then enter a 6-digit code.</p>
            <img className="twofa-qr" src={twofa.qr} alt="Two-factor QR code" />
            <p className="twofa-secret">{twofa.secret}</p>
            <form className="settings-form" onSubmit={confirm2fa}>
              <input className="otp-input" inputMode="numeric" maxLength={6} value={twofaCode} onChange={(e) => setTwofaCode(e.target.value)} placeholder="123456" />
              <button className="btn btn-primary settings-save-btn" type="submit">Verify &amp; enable</button>
            </form>
          </div>
        )}
      </div>

      {/* ── Notifications ── */}
      <div className="settings-card">
        <div className="settings-section-label">Notifications</div>
        <div className="settings-row">
          <div className="settings-row-info">
            <span className="settings-row-title">Push notifications</span>
            <span className="settings-row-sub">Alerts for likes, replies, tips and messages.</span>
          </div>
          <button className="btn btn-sm btn-primary" onClick={enablePush}><Icon name="bell" size={16} /> Enable</button>
        </div>
      </div>

      {/* ── Messaging ── */}
      <div className="settings-card">
        <div className="settings-card-head">
          <div className="settings-section-label">Messaging</div>
        </div>
        <form onSubmit={saveMessaging}>
          <div className="settings-row settings-row-select">
            <div className="settings-row-info">
              <span className="settings-row-title">Who can send me messages</span>
              <span className="settings-row-sub">Control who can start a direct conversation with you.</span>
            </div>
            <select className="settings-select" name="whoCanDm" defaultValue={me.whoCanDm || "everyone"}>
              <option value="everyone">Everyone</option>
              <option value="following">People I follow</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Show online status</span>
              <span className="settings-row-sub">Let others see when you're currently active.</span>
            </div>
            <label className="toggle-wrap">
              <input className="toggle-cb" type="checkbox" name="showOnline" defaultChecked={me.showOnline} />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
            </label>
          </div>
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Show last seen</span>
              <span className="settings-row-sub">Let others see when you were last active.</span>
            </div>
            <label className="toggle-wrap">
              <input className="toggle-cb" type="checkbox" name="showLastSeen" defaultChecked={me.showLastSeen} />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
            </label>
          </div>
          <button className="btn btn-primary settings-save-btn" type="submit">Save</button>
        </form>
      </div>

      {/* ── Calls ── */}
      <div className="settings-card">
        <div className="settings-section-label">Calls</div>
        <div className="settings-row ring-setting-row">
          <div className="settings-row-info ring-info">
            <span className="settings-row-title">Ringtone</span>
            <span className="settings-row-sub">MP3, OGG or WAV — max 8 MB.</span>
            {me.ringtoneUrl && <span className="muted small">Custom ringtone set.</span>}
          </div>
          <div className="ring-actions">
            <label className="btn btn-sm btn-primary ring-choose-btn">
              <Icon name="upload" size={15} /> Choose
              <input
                type="file"
                accept="audio/*"
                hidden
                ref={ringInput}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadRingtone(f); }}
              />
            </label>
            {me.ringtoneUrl && (
              <>
                <button className="btn btn-sm" onClick={previewRingtone}>Preview</button>
                <button className="btn btn-sm btn-danger" onClick={removeRingtone}>Remove</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Appearance ── */}
      <div className="settings-card">
        <div className="settings-section-label">Appearance</div>
        <div className="settings-row">
          <div className="settings-row-info">
            <span className="settings-row-title">Theme</span>
            <span className="settings-row-sub">Switch between dark and light mode.</span>
          </div>
          <button className="btn btn-sm theme-toggle" onClick={toggleTheme}>
            <Icon name="sun" size={16} /> <Icon name="moon" size={16} />
          </button>
        </div>
      </div>

      {/* ── Danger zone ── */}
      <div className="settings-card settings-danger-card">
        <div className="settings-section-label settings-danger-label">Danger zone</div>
        <div className="settings-row">
          <div className="settings-row-info">
            <span className="settings-row-title">Delete account</span>
            <span className="settings-row-sub">Permanently removes your data and all media.</span>
          </div>
          <button type="button" className="btn btn-sm btn-danger" onClick={deleteAccount}>
            <Icon name="trash" size={15} /> Delete
          </button>
        </div>
      </div>
    </>
  );
}



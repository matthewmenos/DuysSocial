import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Avatar } from "../../components/Icon";

export function SettingsPage() {
  const { boot, refresh } = useAuth();
  const [secret, setSecret] = useState("");
  const [qr, setQr] = useState("");
  return (
    <div>
      <h2>Settings</h2>
      <form onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await api("/api/settings", { method: "POST", body: JSON.stringify({ displayName: fd.get("displayName"), bio: fd.get("bio"), location: fd.get("location"), website: fd.get("website"), whoCanDm: fd.get("whoCanDm") }) });
        refresh();
      }}>
        <div className="field"><label>Name</label><input name="displayName" defaultValue={boot?.user?.displayName} /></div>
        <div className="field"><label>Bio</label><textarea name="bio" /></div>
        <div className="field"><label>Location</label><input name="location" /></div>
        <div className="field"><label>Website</label><input name="website" /></div>
        <div className="field"><label>Who can DM</label>
          <select name="whoCanDm"><option>everyone</option><option>following</option><option>nobody</option></select>
        </div>
        <button className="btn btn-primary">Save</button>
      </form>
      <h3>Avatar</h3>
      <input type="file" onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        const fd = new FormData(); fd.append("file", f);
        await api("/api/settings/upload-avatar", { method: "POST", body: fd }); refresh();
      }} />
      <h3>2FA</h3>
      <button className="btn" onClick={async () => {
        const d = await api("/api/auth/2fa/setup");
        setSecret(d.secret); setQr(d.qr);
      }}>Set up 2FA</button>
      {qr && <img src={qr} alt="QR" />}
      {secret && (
        <form onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          await api("/api/auth/2fa/enable", { method: "POST", body: JSON.stringify({ secret, token: fd.get("token") }) });
        }}>
          <input name="token" placeholder="Code" />
          <button className="btn btn-primary">Enable</button>
        </form>
      )}
      <Link to="/verification">Verification</Link>
    </div>
  );
}

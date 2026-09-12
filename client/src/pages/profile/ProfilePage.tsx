import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Avatar, Badge, Icon } from "../../components/Icon";
import { PostCard, type Post } from "../../components/PostCard";

export function ProfilePage() {
  const { username } = useParams();
  const { boot, refresh } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const load = () => api(`/api/u/${username}`).then(setData);
  useEffect(() => { load(); }, [username]);
  if (!data) return null;
  const u = data.user;
  const mine = boot?.user?.username === u.username;
  return (
    <>
      <div className="page-head glass-bar">
        <button className="icon-btn" onClick={() => nav(-1)}><Icon name="arrow-left" size={20} /></button>
        <div className="page-head-info">
          <h1>{u.displayName}</h1>
          <small className="muted">{data.posts.length} posts</small>
        </div>
      </div>
      <div className="profile-banner" id="profile-banner">
        {u.bannerUrl && <img className="profile-banner-img" src={u.bannerUrl} alt="" />}
        {mine && (
          <label className="profile-banner-edit">
            <span className="profile-banner-edit-icon"><Icon name="camera" size={18} /></span>
            <input type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const fd = new FormData(); fd.append("file", f);
              await api("/api/settings/upload-banner", { method: "POST", body: fd });
              load(); refresh();
            }} />
          </label>
        )}
      </div>
      <div className="profile-header">
        <div className="profile-avatar-row">
          <div className="profile-avatar-wrap">
            <Avatar url={u.avatarUrl} size={96} />
            {mine && (
              <label className="profile-avatar-edit">
                <Icon name="camera" size={16} />
                <input type="file" accept="image/*" hidden onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const fd = new FormData(); fd.append("file", f);
                  await api("/api/settings/upload-avatar", { method: "POST", body: fd });
                  load(); refresh();
                }} />
              </label>
            )}
          </div>
          <div className="profile-actions">
            {mine ? (
              <>
                {!u.verifiedBadge && <Link className="btn btn-verify btn-sm" to="/verification"><Icon name="verify" size={15} /> Get verified</Link>}
                <Link className="btn btn-sm btn-outline" to="/settings">Edit profile</Link>
              </>
            ) : (
              <>
                <Link className="icon-btn-outline" to={`/messages/start/${u.username}`} title="Message"><Icon name="mail" size={20} /></Link>
                <button className="btn btn-sm btn-tip" onClick={async () => {
                  const amt = Number(window.prompt("Tip points", "10") || "0");
                  if (!amt) return;
                  await api("/api/wallet/tip", { method: "POST", body: JSON.stringify({ toId: u.id, amount: amt, currency: "points" }) });
                }}>💎 Tip</button>
                <button className={`btn btn-sm btn-follow ${data.isFollowing ? "following" : ""}`} onClick={async () => {
                  await api(`/api/u/${username}/follow`, { method: "POST", body: "{}" }); load();
                }}>{data.isFollowing ? "Following" : "Follow"}</button>
              </>
            )}
          </div>
        </div>
        <div className="profile-meta">
          <h2 className="profile-name">{u.displayName}<Badge kind={u.verifiedBadge} /></h2>
          <p className="profile-handle">@{u.username}</p>
          {u.bio && <p className="profile-bio">{u.bio}</p>}
          <p className="profile-stats"><strong>{data.following}</strong> Following · <strong>{data.followers}</strong> Followers</p>
        </div>
      </div>
      {data.posts.map((p: Post) => <PostCard key={p.id} post={p} onChange={load} />)}
    </>
  );
}

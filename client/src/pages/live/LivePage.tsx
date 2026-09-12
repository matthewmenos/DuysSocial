import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { Avatar, Icon } from "../../components/Icon";

export function LivePage() {
  const nav = useNavigate();
  const [rooms, setRooms] = useState<any[]>([]);
  useEffect(() => { api("/api/live").then((d) => setRooms(d.rooms || [])); }, []);
  const lives = rooms.filter((r) => r.kind !== "space");
  const spaces = rooms.filter((r) => r.kind === "space");
  return (
    <>
      <div className="page-head glass-bar"><h1>Live & Spaces</h1></div>
      <div className="live-cta">
        <button className="btn btn-primary" onClick={async () => {
          const d = await api("/api/live/start", { method: "POST", body: JSON.stringify({ kind: "video", title: "Live" }) });
          nav(`/live/${d.room.id}`);
        }}><Icon name="video" size={18} /> Go Live</button>
        <button className="btn" onClick={async () => {
          const d = await api("/api/live/start", { method: "POST", body: JSON.stringify({ kind: "space", title: "Space" }) });
          nav(`/live/${d.room.id}`);
        }}><Icon name="broadcast" size={18} /> Host a Space</button>
      </div>
      <h3 className="section-title"><Icon name="video" size={18} /> Live now</h3>
      <div className="live-grid">
        {lives.map((r) => (
          <Link className="live-card" key={r.id} to={`/live/${r.id}`}>
            <span className="live-thumb"><Avatar url={r.host?.avatarUrl} size={64} /><span className="live-badge">LIVE</span></span>
            <div className="live-card-info">
              <strong>{r.title || "Live video"}</strong>
              <span className="muted">@{r.host?.username}</span>
            </div>
          </Link>
        ))}
        {!lives.length && <p className="muted live-empty">No live videos right now.</p>}
      </div>
      <h3 className="section-title"><Icon name="broadcast" size={18} /> Spaces</h3>
      <div className="space-list">
        {spaces.map((r) => (
          <Link className="space-card" key={r.id} to={`/live/${r.id}`}>
            <span className="space-dot" />
            <div className="space-card-info">
              <strong>{r.title || "Audio Space"}</strong>
              <span className="muted">Hosted by @{r.host?.username}</span>
            </div>
            <Icon name="broadcast" size={20} />
          </Link>
        ))}
        {!spaces.length && <p className="muted live-empty">No active Spaces.</p>}
      </div>
    </>
  );
}

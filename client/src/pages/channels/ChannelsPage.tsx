import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { Avatar, Icon } from "../../components/Icon";
import { BusyButton } from "../../components/BusyButton";
import { useBusy } from "../../components/useBusy";
import { PageLoading } from "../../components/PageState";

type Channel = {
  id: number;
  name: string;
  handle: string;
  description: string;
  avatarUrl: string;
  subscriberCount: number;
  isPrivate: boolean;
  role?: string | null;
  isMuted?: boolean;
  joined?: boolean;
};

/** Mirrors DUYS/duys/templates/channels/index.html. */
export function ChannelsPage() {
  const [data, setData] = useState<{ mine: Channel[]; discover: Channel[]; q: string } | null>(null);
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [avatarName, setAvatarName] = useState("");
  const [preview, setPreview] = useState("");
  const [err, setErr] = useState("");
  const { busy: creating, run: runCreate } = useBusy();
  const { busy: joining, run: runJoin } = useBusy();
  const avatarInput = useRef<HTMLInputElement>(null);

  const load = (term = "") => api(`/api/channels${term ? `?q=${encodeURIComponent(term)}` : ""}`).then(setData).catch(() => {});
  useEffect(() => { void load(); }, []);

  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const avatar = avatarInput.current?.files?.[0];
    if (avatar) fd.append("avatar", avatar);
    void runCreate(async () => {
      try {
        await api("/api/channels/create", { method: "POST", body: fd });
        setDrawer(false);
        setPreview("");
        setAvatarName("");
        await load(q);
      } catch (ex) {
        setErr((ex as Error).message);
      }
    });
  }

  function subscribe(handle: string) {
    void runJoin(async () => {
      await api(`/api/channels/c/${handle}/subscribe`, { method: "POST", body: "{}" }).catch(() => {});
      await load(q);
    });
  }

  if (!data) return <PageLoading label="Loading channels…" />;

  return (
    <>
      <div className="page-head glass-bar">
        <h1>Channels</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setDrawer(true)}>
          <Icon name="plus" size={16} /> New
        </button>
      </div>

      {/* ── Create channel drawer ── */}
      {drawer && (
        <div className="ch-create-drawer">
          <div className="ch-create-backdrop" onClick={() => setDrawer(false)} />
          <div className="ch-create-panel">
            <div className="ch-create-handle-bar" />
            <h2 className="ch-create-title">New channel</h2>
            <form onSubmit={create}>
              <div className="ch-create-avatar-pick" onClick={() => avatarInput.current?.click()}>
                <div className="ch-avatar-preview">
                  {preview ? <img src={preview} alt="" /> : <Icon name="broadcast" size={28} />}
                </div>
                <span className="ch-avatar-hint">{avatarName || "Add photo"}</span>
                <input
                  ref={avatarInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setAvatarName(f.name);
                    setPreview(URL.createObjectURL(f));
                  }}
                />
              </div>

              <div className="ch-field">
                <label className="ch-label">Channel name</label>
                <input className="ch-input" type="text" name="name" placeholder="My Channel" required maxLength={80} />
              </div>

              <div className="ch-field">
                <label className="ch-label">
                  Handle <span className="muted small">public link: /channels/c/yourhandle</span>
                </label>
                <div className="ch-input-prefix">
                  <span className="ch-prefix">@</span>
                  <input className="ch-input" type="text" name="handle" placeholder="mychannel" maxLength={32} autoComplete="off" />
                </div>
              </div>

              <div className="ch-field">
                <label className="ch-label">Description <span className="muted small">optional</span></label>
                <textarea className="ch-input ch-textarea" name="description" rows={2} placeholder="What is this channel about?" maxLength={300} />
              </div>

              <div className="ch-field ch-toggle-row">
                <div>
                  <div className="ch-label">Private channel</div>
                  <div className="muted small">Only people with the invite link can join</div>
                </div>
                <label className="ch-toggle">
                  <input type="checkbox" name="isPrivate" />
                  <span className="ch-toggle-track" />
                </label>
              </div>

              {err && <p className="flash flash-error">{err}</p>}
              <BusyButton className="btn btn-primary btn-block" type="submit" busy={creating} busyLabel="Creating…">Create channel</BusyButton>
            </form>
          </div>
        </div>
      )}

      {/* ── My channels ── */}
      {data.mine.length > 0 && (
        <>
          <div className="ch-section-head">My channels</div>
          <div className="ch-list">
            {data.mine.map((ch) => (
              <Link className="ch-row" key={ch.id} to={`/channels/c/${ch.handle}`}>
                <div className="ch-row-av">
                  <Avatar url={ch.avatarUrl} size={52} alt={ch.name} />
                  {ch.isPrivate && <span className="ch-private-icon" title="Private">🔒</span>}
                </div>
                <div className="ch-row-info">
                  <div className="ch-row-name">
                    {ch.name}
                    {ch.role === "owner" && <span className="ch-role-chip ch-owner">Owner</span>}
                    {ch.role === "admin" && <span className="ch-role-chip ch-admin">Admin</span>}
                  </div>
                  <div className="ch-row-sub muted small">{ch.subscriberCount.toLocaleString()} subscribers</div>
                </div>
                <div className="ch-row-meta">
                  {ch.isMuted ? (
                    <span className="ch-muted-icon" title="Muted"><Icon name="eye-off" size={14} /></span>
                  ) : (
                    <Icon name="chevron" size={16} />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ── Search ── */}
      <form className="ch-search" onSubmit={(e) => { e.preventDefault(); void load(q); }}>
        <label className="ch-search-wrap">
          <Icon name="search" size={16} />
          <input
            className="ch-search-input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search public channels…"
            autoComplete="off"
          />
        </label>
      </form>

      <div className="ch-section-head">{data.q ? `Results for "${data.q}"` : "Discover"}</div>

      {data.discover.length > 0 ? (
        <div className="ch-grid">
          {data.discover.map((ch) => (
            <div className="ch-card" key={ch.id}>
              <Link className="ch-card-link" to={`/channels/c/${ch.handle}`}>
                <div className="ch-card-cover" />
                <div className="ch-card-body">
                  <div className="ch-card-av"><Avatar url={ch.avatarUrl} size={52} alt={ch.name} /></div>
                  <div className="ch-card-name">{ch.name}</div>
                  <div className="ch-card-handle muted">@{ch.handle}</div>
                  {ch.description && <p className="ch-card-desc muted">{ch.description}</p>}
                  <div className="ch-card-footer">
                    <span className="ch-subs-pill"><Icon name="user" size={13} /> {ch.subscriberCount.toLocaleString()}</span>
                    {ch.joined && <span className="ch-joined-pill">Joined</span>}
                  </div>
                </div>
              </Link>
              <BusyButton
                className={`btn btn-sm ${ch.joined ? "ch-card-leave-btn btn-subscribed" : "btn-primary ch-card-join-btn"}`}
                busy={joining}
                busyLabel={ch.joined ? "Leaving…" : "Joining…"}
                onClick={() => subscribe(ch.handle)}
              >
                {ch.joined ? "Joined" : "Join"}
              </BusyButton>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="broadcast" size={48} />
          <h3>{data.q ? "No channels found" : "No public channels yet"}</h3>
          <p>Create the first broadcast channel.</p>
        </div>
      )}

    </>
  );
}


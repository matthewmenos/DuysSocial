import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { Avatar, Icon } from "../../components/Icon";
import { Composer } from "../../components/Composer";
import { PageError, PageLoading } from "../../components/PageState";

const EMOJIS = ["😀","😂","😍","👍","🙏","🔥","❤️","🎉","😭","😮","😅","💯","👀","🤝","💰","🚀"];

/** Telegram-style broadcast view — mirrors DUYS/duys/templates/channels/view.html. */
export function ChannelView() {
  const { handle } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loadErr, setLoadErr] = useState("");
  const [composer, setComposer] = useState(false);
  const [emojiPickerFor, setEmojiPickerFor] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const load = async () => {
    try { setData(await api(`/api/channels/c/${handle}`)); setLoadErr(""); }
    catch (ex) { setLoadErr((ex as Error).message || "Could not load this channel."); }
  };
  useEffect(() => { load(); }, [handle]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [data?.posts?.length, data?.pinned]);
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiPickerFor(null); }
    if (emojiPickerFor !== null) { document.addEventListener("mousedown", onDoc); return () => document.removeEventListener("mousedown", onDoc); }
  }, [emojiPickerFor]);

  if (loadErr) return <PageError message={loadErr} onRetry={() => void load()} />;
  if (!data) return <PageLoading label="Loading channel…" />;
  if (data.gated) return <div className="ch-join-gate"><Icon name="lock" size={44} /><h2>Private channel</h2><p>You need an invite link to join.</p></div>;
  const ch = data.channel as any;
  const role = (data.role || "member") as string;
  const canModerate = role === "owner" || role === "admin";
  const pinned = data.pinned as any | null;
  const posts = (data.posts || []) as any[];
  const feed = pinned ? [pinned, ...posts.filter((p) => p.id !== pinned.id)] : posts;
  async function react(p: any, e: string) {
    try { await api(`/api/posts/${p.id}/react`, { method: "POST", body: JSON.stringify({ emoji: e }) }); await load(); } catch {}
    setEmojiPickerFor(null);
  }
  async function trackView(p: any) { try { await api(`/api/channels/c/${handle}/view/${p.id}`, { method: "POST", body: "{}" }); } catch {} }
  async function subscribe() { try { await api(`/api/channels/c/${handle}/subscribe`, { method: "POST", body: "{}" }); await load(); } catch {} }

  return (
    <div className="bc-layout">
      <header className="bc-topbar glass-bar">
        <button className="icon-btn bc-back" aria-label="Back" onClick={() => nav(-1)}><Icon name="arrow-left" size={20} /></button>
        <button className="bc-head-identity" onClick={() => setSettingsOpen(true)}>
          <Avatar url={ch.avatarUrl} size={38} alt={ch.name} />
          <div className="bc-head-text">
            <strong className="bc-head-name">{ch.name}{ch.verifiedBadge && <span className="bc-verified-seal">✦</span>}</strong>
            <span className="bc-head-sub">{ch.subscriberCount?.toLocaleString() || 0} subscribers</span>
          </div>
        </button>
        <div className="bc-topbar-actions">
          {canModerate && <button className="icon-btn" title="Settings" onClick={() => setSettingsOpen(true)}><Icon name="settings" size={20} /></button>}
        </div>
      </header>
      {pinned && (
        <div className="bc-pinned-bar">
          <Icon name="star" size={13} />
          <div className="bc-pinned-bar-body">
            <span className="bc-pinned-bar-label">Pinned message</span>
            <span className="bc-pinned-bar-text">{(pinned.body || "Media").slice(0, 60)}</span>
          </div>
          {canModerate && (
            <form onSubmit={(e) => { e.preventDefault(); api(`/api/channels/c/${handle}/unpin`, { method: "POST", body: "{}" }).then(load); }}>
              <button className="bc-pinned-close" title="Unpin"><Icon name="close" size={14} /></button>
            </form>
          )}
        </div>
      )}
      <div className="bc-messages" id="bc-messages">
        {pinned && (
          <div className="bc-pinned-bubble-wrap">
            <BroadcastCard post={pinned} channel={ch} isAdmin={canModerate} onReact={react} onTrackView={() => trackView(pinned)}
              emojiPickerFor={emojiPickerFor} setEmojiPickerFor={setEmojiPickerFor} emojiRef={emojiRef} />
          </div>
        )}
        {feed.length === 0
          ? <div className="bc-empty"><Icon name="broadcast" size={52} /><p>No broadcasts yet{canModerate ? " — send the first one below" : ""}</p></div>
          : feed.map((p: any) => (
              <BroadcastCard key={p.id} post={p} channel={ch} isAdmin={canModerate}
                onReact={react} onTrackView={() => trackView(p)}
                emojiPickerFor={emojiPickerFor} setEmojiPickerFor={setEmojiPickerFor} emojiRef={emojiRef} />
            ))
        }
      </div>
      {emojiPickerFor !== null && (
        <div className="bc-emoji-picker" id="bc-emoji-picker" ref={emojiRef}>
          {EMOJIS.map((e) => (<button key={e} className="bc-emoji-opt" data-emoji={e} onClick={() => react(feed.find((p) => p.id === emojiPickerFor)!, e)}>{e}</button>))}
        </div>
      )}
      {composer
        ? <div className="bc-compose-bar"><Composer channelId={ch.id} limit={2000} onPosted={() => { setComposer(false); load(); }} onClose={() => setComposer(false)} /></div>
        : (role !== "member"
            ? <div className="bc-compose-bar composer-closed"><button className="bc-compose-btn" onClick={() => setComposer(true)}><Icon name="plus" size={20} /><span>Broadcast</span></button></div>
            : <div className="bc-compose-bar"><form onSubmit={async(e)=>{e.preventDefault();await subscribe();}}>
                 <button className="bc-join-btn w-100">{data.subscribed ? "Leave" : "Join"}</button>
               </form></div>)}
      <div ref={bottom} />
      {settingsOpen && <ChannelsSidebar handle={ch.handle} isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onDelete={() => nav("/channels")} />}
    </div>
  );
}

/** Broadcast bubble — mirrors the legacy broadcast_card macro. */
function BroadcastCard({ post, channel, isAdmin, onReact, onTrackView, emojiPickerFor, setEmojiPickerFor, emojiRef }: {
  post: any; channel: any; isAdmin: boolean;
  onReact: (p: any, e: string) => void; onTrackView: () => void;
  emojiPickerFor: number | null; setEmojiPickerFor: (v: number | null) => void; emojiRef: React.RefObject<HTMLDivElement>;
}) {
  useEffect(() => { onTrackView(); }, []);
  const media = post.media || [];
  const reactions = post.reactions || [];
  return (
    <div className="bc-wrap" data-post-id={post.id}>
      <div className="bc-bubble">
        <div className="bc-channel-strip">
          <Avatar url={channel.avatarUrl} size={22} alt={channel.name} />
          <span className="bc-channel-name">{channel.name}</span>
          {isAdmin && (
            <form onSubmit={(e) => { e.preventDefault(); api(`/api/channels/c/${channel.handle}/pin/${post.id}`, { method: "POST", body: "{}" }).then(() => onTrackView()); }}>
              <button className="bc-pin-btn" title="Pin"><Icon name="star" size={14} /></button>
            </form>
          )}
        </div>
        {media.length > 0 && (
          media.length === 1 && media[0].kind === "video"
            ? <div className="bc-video-wrap" data-src={media[0].url}><video src={media[0].url} preload="none" playsInline muted /><div className="bc-video-overlay"><button className="bc-video-play" type="button"><Icon name="play" size={24} /></button></div></div>
            : <div className={`bc-media-grid bc-media-count-${Math.min(media.length, 4)}`}>
                {media.slice(0, 4).map((m: any, i: number) =>
                  m.kind === "video"
                    ? <div key={m.id || i} className="bc-video-wrap bc-media-item" data-src={m.url}><video src={m.url} preload="none" playsInline muted /><div className="bc-video-overlay"><button className="bc-video-play" type="button"><Icon name="play" size={20} /></button></div></div>
                    : <img key={m.id || i} className="bc-media-item" src={m.url} alt="" loading="lazy" />
                )}
              </div>
        )}
        {post.body && <p className="bc-text">{post.body}</p>}
        {reactions.length > 0 && (
          <div className="bc-reactions" data-post-id={post.id}>
            {reactions.map((r: any) => (
              <button key={r.emoji} className={`bc-reaction${r.mine ? " bc-reaction-mine" : ""}`} data-emoji={r.emoji}>
                <span>{r.emoji}</span><span className="bc-reaction-count">{r.count}</span>
              </button>
            ))}
          </div>
        )}
        <div className="bc-meta">
          <button className="bc-forward-btn" title="Forward"><Icon name="share-out" size={16} /></button>
          <span className="bc-views-row"><Icon name="chart" size={14} /><span className="bc-view-count">{post.viewCount || 0}</span></span>
          <button className="bc-react-btn" title="React" onClick={() => setEmojiPickerFor(emojiPickerFor === post.id ? null : post.id)}><Icon name="heart" size={16} /></button>
          <time className="bc-time" data-ts={post.createdAt}>{new Date(post.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
        </div>
      </div>
    </div>
  );
}

/** Settings slide-up sheet — mirrors channels/view.html settings/verification/delete section. */
function ChannelsSidebar({ handle, isOpen, onClose, onDelete }: {
  handle: string; isOpen: boolean; onClose: () => void; onDelete: () => void;
}) {
  const [info, setInfo] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  useEffect(() => {
    api(`/api/channels/c/${handle}/info`).then(setInfo).catch(() => {});
    api(`/api/channels/c/${handle}/members`).then((d) => setMembers(d.members || [])).catch(() => {});
  }, [handle]);
  async function copyInvite() {
    let token = info?.inviteToken;
    if (!token) { const d = await api(`/api/channels/c/${handle}`, { method: "POST", body: JSON.stringify({ rotateInvite: true }) }); token = d.inviteToken; }
    navigator.clipboard.writeText(`${window.location.origin}/channels/c/${handle}?invite=${token}`);
  }
  if (!isOpen) return null;
  return (
    <div className="ch-settings-panel">
      <div className="ch-settings-backdrop" onClick={onClose} />
      <div className="ch-settings-sheet">
        <div className="ch-settings-handle" />
        <h2 className="ch-settings-title">Channel settings</h2>
        {info && (
          <>
            <div className="ch-info-section">
              <div className="ch-info-section-title">Invite link</div>
              <div className="ch-invite-row">
                <code className="ch-invite-code">{info.inviteToken?.slice(0, 8)}…</code>
                <button className="btn btn-sm" onClick={copyInvite}><Icon name="copy" size={14} /> Copy link</button>
              </div>
            </div>
            <div className="ch-info-section">
              <div className="ch-info-section-title">Members ({members.length})</div>
              <div className="ch-members-list">
                {members.map((m: any) => m.user && (
                  <div key={m.user.id} className="ch-member-row">
                    <Avatar url={m.user.avatarUrl} size={36} alt={m.user.displayName} />
                    <div className="ch-member-info">
                      <div className="ch-member-name">{m.user.displayName || m.user.username}</div>
                      <div className="muted small">{m.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <hr className="ch-divider" />
            <div className="ch-info-section">
              <div className="ch-info-section-title">Danger</div>
              <button className="btn btn-danger btn-block" onClick={() => { onClose(); onDelete(); }}><Icon name="trash" size={14} /> Delete channel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { Avatar, Icon } from "../../components/Icon";

const STORY_DURATION = 5000;
const REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

type StoryUser = { id: number; username: string; displayName: string; avatarUrl: string };
type Story = { id: number; user: StoryUser; mediaUrl: string; mediaKind: string; caption: string; createdAt: string; viewCount: number; replyCount: number; reacted: boolean; reactions?: Record<string, number>; };

/** Instagram-style story viewer — mirrors DUYS stories.js (sv-* classes). */
export function StoriesPage() {
  const { username } = useParams();
  const nav = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [replyText, setReplyText] = useState("");
  const timerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    api(`/api/stories/u/${username}`).then((d) => { setStories(d.stories || []); setCurrentIdx(0); });
  }, [username]);

  useEffect(() => {
    if (paused || stories.length === 0) return;
    const start = Date.now();
    timerRef.current = window.setInterval(() => {
      if (Date.now() - start >= STORY_DURATION) {
        if (timerRef.current) clearInterval(timerRef.current);
        if (currentIdx < stories.length - 1) setCurrentIdx(i => i + 1);
        else nav("/stories");
      }
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, currentIdx, stories.length]);

  function prev() { if (timerRef.current) clearInterval(timerRef.current); if (currentIdx > 0) setCurrentIdx(i => i - 1); }
  function next() { if (timerRef.current) clearInterval(timerRef.current); if (currentIdx < stories.length - 1) setCurrentIdx(i => i + 1); else nav("/stories"); }

  async function react(e: string) { const s = stories[currentIdx]; if (!s) return; try { await api(`/api/stories/${s.id}/react`, { method: "POST", body: JSON.stringify({ emoji: e }) }); } catch {} setShowReactions(false); }

  async function sendReply() { const s = stories[currentIdx]; if (!s || !replyText.trim()) return; try { await api(`/api/stories/${s.id}/reply`, { method: "POST", body: JSON.stringify({ body: replyText }) }); setReplyText(""); } catch {} }

  if (!stories.length) return <div className="bc-empty"><Icon name="image" size={48} /><p>No stories.</p></div>;

  const s = stories[currentIdx];

  return (
    <div className="story-viewer">
      <div className="sv-stage">
        <div className="sv-progress">
          {stories.map((_, i) => (<div key={i} className={`sv-bar ${i < currentIdx ? "done" : ""} ${i === currentIdx ? "active" : ""}`}><span style={{ animationDuration: paused ? "0s" : "5000ms" }} /></div>))}
        </div>
        <div className="sv-head">
          <Avatar url={s.user.avatarUrl} size={36} alt={s.user.displayName} />
          <span className="sv-head-name">{s.user.displayName}</span>
          <span className="sv-head-time muted">{new Date(s.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          <button className="sv-pause-btn" onClick={() => setPaused(!paused)}>{paused ? <Icon name="play" size={18} /> : <Icon name="pause" size={18} />}</button>
          <button className="sv-close" onClick={() => nav("/stories")}><Icon name="close" size={20} /></button>
        </div>
        <div className="sv-media-wrap" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {s.mediaKind === "video" ? <video ref={videoRef} src={s.mediaUrl} autoPlay playsInline muted style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <img src={s.mediaUrl} alt="" className="sv-media" />}
        </div>
        {s.caption && <p className="sv-caption">{s.caption}</p>}
        {showReactions && (<div className="sv-reaction-bar">{REACTIONS.map((e) => <button key={e} className="sv-emoji-btn" onClick={() => react(e)}>{e}</button>)}</div>)}
        <div className="sv-views"><Icon name="eye" size={14} /> {s.viewCount || 0} views</div>
        <div className="sv-footer-bar" style={{ position: "absolute", bottom: 20, left: 0, right: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 16px" }}>
          <form onSubmit={(e) => { e.preventDefault(); react("❤️"); }}><button type="submit" className="sv-emoji-btn"><Icon name="heart" size={24} /></button></form>
          <input className="sv-reply-input" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Reply…" style={{ flex: 1 }} />
          <button className="sv-emoji-btn" onClick={sendReply}><Icon name="send" size={20} /></button>
        </div>
        <div className="sv-nav sv-prev" onClick={prev} />
        <div className="sv-nav sv-next" onClick={next} />
      </div>
    </div>
  );
}

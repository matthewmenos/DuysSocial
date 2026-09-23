import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Avatar, Badge, Icon } from "../../components/Icon";
import { PostCard, type Post } from "../../components/PostCard";
import { PageLoading } from "../../components/PageState";

export function HomePage() {
  const { boot, refresh } = useAuth();
  const ctx = useOutletContext<{ openComposer?: () => void } | null>();
  const nav = useNavigate();
  const [scope, setScope] = useState("for_you");
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ posts: Post[]; myStory: { id: number }[]; otherStories: { id: number; mediaUrl: string; author?: { username: string; displayName: string; avatarUrl: string } }[]; suggestions: { username: string; displayName: string; avatarUrl: string; verifiedBadge: string }[] } | null>(null);
  const [newPosts, setNewPosts] = useState(0);
  const [showNewPostsBanner, setShowNewPostsBanner] = useState(false);
  // State (not a ref) so the polling effect below starts once the first page loads.
  const [topPostId, setTopPostId] = useState<number | null>(null);
  const storyFile = useRef<HTMLInputElement>(null);
  const load = () => api(`/api/feed?scope=${scope}`).then((d) => {
    setData(d);
    if (d.posts?.length) setTopPostId(d.posts[0].id);
  }).catch(() => {});
  useEffect(() => { load(); }, [scope]);
  // Poll for new posts every 30s
  useEffect(() => {
    if (topPostId == null) return;
    const interval = setInterval(async () => {
      try {
        const r = await api(`/api/feed?scope=${scope}&since=${topPostId}`);
        if (r.newPosts > 0) {
          setNewPosts(r.newPosts);
          setShowNewPostsBanner(true);
        }
      } catch { /* ignore */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [scope, topPostId]);
  const handleNewPostsClick = useCallback(() => {
    setShowNewPostsBanner(false);
    setNewPosts(0);
    load();
  }, []);
  if (!boot?.user) return <PageLoading rows={0} />; // AppShell redirects to login; show placeholder while the redirect takes effect
  if (!data) return <PageLoading label="Loading your feed…" />;
  const user = boot.user;
  return (
    <>
      <div className="feed-topbar glass-bar">
        <span className="feed-topbar-brand">
          <img src="/icons/favicon.svg" width={28} height={28} alt="" className="brand-logo" />
          <span className="topbar-label">{boot.appName}</span>
        </span>
        <div className="feed-topbar-spacer" />
        <form className="feed-topbar-search" onSubmit={(e) => { e.preventDefault(); nav(`/search?q=${encodeURIComponent(q)}`); }}>
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
        </form>
        <div className="feed-topbar-actions">
          <Link className="icon-btn topbar-bell" to="/notifications" title="Notifications">
            <Icon name="bell" size={22} />
            {boot.unreadNotifications > 0 && <span className="topbar-badge">{boot.unreadNotifications}</span>}
          </Link>
        </div>
      </div>
      {/* N new posts banner */}
      {showNewPostsBanner && (
        <div className="feed-new-posts-banner" onClick={handleNewPostsClick}>
          <Icon name="spark" size={16} />
          <span>{newPosts} new post{newPosts > 1 ? "s" : ""}</span>
        </div>
      )}
      <div className="stories-bar" id="stories-bar">
        <button className="story mine" onClick={() => storyFile.current?.click()}>
          <span className={`story-ring ${data.myStory?.length ? "has" : ""}`}>
            <span className="story-av"><Avatar url={user.avatarUrl} size={60} /></span>
            <span className="story-add"><Icon name="plus" size={14} /></span>
          </span>
          <span className="story-name">Your story</span>
        </button>
        {data.otherStories.map((s) => (
          <button key={s.id} className="story" onClick={() => nav(`/stories/${s.author?.username}`)}>
            <span className="story-ring">
              <span className="story-av"><Avatar url={s.author?.avatarUrl} size={60} /></span>
            </span>
            <span className="story-name">{s.author?.displayName}</span>
          </button>
        ))}
      </div>
      <input ref={storyFile} type="file" accept="image/*,video/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        const fd = new FormData(); fd.append("media", f);
        await api("/api/stories", { method: "POST", body: fd });
        load(); refresh();
      }} />
      <div className="quick-compose">
        <Avatar url={user.avatarUrl} size={44} />
        <button className="quick-compose-input" onClick={() => ctx?.openComposer?.()}>What is happening?</button>
      </div>
      <div className="feed-tabs glass-bar">
        <button className={`feed-tab ${scope === "for_you" ? "active" : ""}`} onClick={() => setScope("for_you")}>For you</button>
        <button className={`feed-tab ${scope === "following" ? "active" : ""}`} onClick={() => setScope("following")}>Following</button>
      </div>
      <div className="feed" id="feed">
        {data.posts.map((p, i) => (
          <span key={p.id}>
            <PostCard post={p} onChange={load} />
            {i === 2 && data.suggestions?.length > 0 && (
              <div className="feed-wtf-strip">
                <div className="fwtf-header"><span className="fwtf-title">Suggested for you</span></div>
                <div className="fwtf-scroll">
                  {data.suggestions.map((u) => (
                    <div className="fwtf-card" key={u.username}>
                      <Link to={`/u/${u.username}`} className="fwtf-avatar-link"><Avatar url={u.avatarUrl} size={72} /></Link>
                      <Link to={`/u/${u.username}`} className="fwtf-name"><span className="fwtf-name-text">{u.displayName}</span><Badge kind={u.verifiedBadge} /></Link>
                      <span className="fwtf-handle">@{u.username}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </span>
        ))}
        {!data.posts.length && <p className="muted" style={{ padding: 24 }}>No posts yet. Be the first.</p>}
      </div>
    </>
  );
}

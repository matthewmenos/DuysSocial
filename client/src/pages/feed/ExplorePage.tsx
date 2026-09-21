import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { Avatar, Badge, Icon } from "../../components/Icon";
import { PostCard, type Post } from "../../components/PostCard";

/** Mirrors DUYS/duys/templates/feed/explore.html. */
export function ExplorePage() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{
    posts: Post[];
    topVerified: { username: string; displayName: string; avatarUrl: string; verifiedBadge: string; points: number }[];
  } | null>(null);

  useEffect(() => { api("/api/explore").then(setRes).catch(() => {}); }, []);

  return (
    <>
      <div className="page-head glass-bar"><h1>Explore</h1></div>

      <form
        className="search-bar"
        onSubmit={(e) => { e.preventDefault(); if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`); }}
      >
        <Icon name="search" size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search DUYS" />
      </form>

      {Boolean(res?.topVerified.length) && (
        <div className="explore-section">
          <h3 className="explore-section-title">Verified accounts</h3>
          <div className="explore-verified-list">
            {res!.topVerified.map((u) => (
              <Link className="explore-verified-card" key={u.username} to={`/u/${u.username}`}>
                <Avatar url={u.avatarUrl} size={44} alt={u.displayName} />
                <div className="explore-verified-info">
                  <div className="explore-verified-name">{u.displayName}<Badge kind={u.verifiedBadge} /></div>
                  <div className="explore-verified-handle muted small">@{u.username}</div>
                </div>
                <span className="explore-verified-stat muted small">{u.points} $DUYS</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="feed">
        {res?.posts.map((p) => <PostCard key={p.id} post={p} />)}
        {res && !res.posts.length && (
          <div className="empty-state"><Icon name="explore" size={48} /><h3>Nothing to explore yet</h3></div>
        )}
      </div>
    </>
  );
}


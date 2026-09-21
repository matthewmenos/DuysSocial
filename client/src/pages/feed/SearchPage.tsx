import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { Avatar, Badge, Icon } from "../../components/Icon";
import { PostCard, type Post } from "../../components/PostCard";

type Hit = {
  users: { username: string; displayName: string; avatarUrl: string; verifiedBadge: string; bio: string }[];
  hashtags: { tag: string; postCount: number }[];
  posts: Post[];
};

/** Mirrors DUYS/duys/templates/feed/search.html. */
export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [term, setTerm] = useState(q);
  const [data, setData] = useState<Hit | null>(null);

  useEffect(() => { setTerm(q); }, [q]);
  useEffect(() => { api(`/api/search?q=${encodeURIComponent(q)}`).then(setData).catch(() => {}); }, [q]);

  return (
    <>
      <div className="page-head glass-bar"><h1>Search</h1></div>

      <form
        className="search-bar"
        onSubmit={(e) => { e.preventDefault(); if (term.trim()) window.location.href = `/search?q=${encodeURIComponent(term.trim())}`; }}
      >
        <Icon name="search" size={18} />
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search DUYS" />
      </form>

      {Boolean(data?.hashtags.length) && (
        <>
          <h3 className="section-title tag-heading">Hashtags</h3>
          <div className="user-list">
            {data!.hashtags.map((h) => (
              <Link className="user-row" key={h.tag} to={`/search?q=${encodeURIComponent(`#${h.tag}`)}`}>
                <div className="user-row-info">
                  <strong>#{h.tag}</strong>
                  <span className="muted">{h.postCount} post{h.postCount === 1 ? "" : "s"}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {Boolean(data?.users.length) && (
        <>
          <h3 className="section-title">People</h3>
          <div className="user-list">
            {data!.users.map((u) => (
              <Link className="user-row" key={u.username} to={`/u/${u.username}`}>
                <Avatar url={u.avatarUrl} size={44} alt={u.displayName} />
                <div className="user-row-info">
                  <strong>{u.displayName}<Badge kind={u.verifiedBadge} /></strong>
                  <span className="muted">@{u.username}</span>
                  {u.bio && <span className="user-bio">{u.bio}</span>}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {Boolean(data?.posts.length) && (
        <>
          <h3 className="section-title">Posts</h3>
          <div className="feed">
            {data!.posts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        </>
      )}

      {data && !data.users.length && !data.hashtags.length && !data.posts.length && (
        <div className="empty-state">
          <Icon name="search" size={48} />
          <h3>No results for “{q}”</h3>
        </div>
      )}
    </>
  );
}


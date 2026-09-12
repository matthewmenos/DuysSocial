import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { Avatar, Badge } from "../../components/Icon";
import { PostCard, type Post } from "../../components/PostCard";

export function ExplorePage() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ posts: Post[]; topVerified: { username: string; displayName: string; avatarUrl: string; verifiedBadge: string }[] } | null>(null);
  useEffect(() => { api("/api/explore").then(setRes); }, []);
  return (
    <div>
      <form onSubmit={async (e) => { e.preventDefault(); window.location.href = `/search?q=${encodeURIComponent(q)}`; }}>
        <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <h3>Verified</h3>
      <div className="who-list">
        {res?.topVerified.map((u) => (
          <Link key={u.username} to={`/u/${u.username}`}><Avatar url={u.avatarUrl} size={36} /> {u.displayName}<Badge kind={u.verifiedBadge} /></Link>
        ))}
      </div>
      {res?.posts.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}

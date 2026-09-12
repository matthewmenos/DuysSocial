import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { PostCard, type Post } from "../../components/PostCard";

export function SearchPage() {
  const [params] = useSearchParams();
  const [data, setData] = useState<{ users: { username: string; displayName: string; avatarUrl: string }[]; posts: Post[]; hashtags: { tag: string }[] } | null>(null);
  useEffect(() => { api(`/api/search?q=${encodeURIComponent(params.get("q") || "")}`).then(setData); }, [params]);
  return (
    <div>
      <h2>Search</h2>
      {data?.users.map((u) => <Link key={u.username} to={`/u/${u.username}`}>{u.displayName} @{u.username}</Link>)}
      {data?.hashtags.map((h) => <div key={h.tag}>#{h.tag}</div>)}
      {data?.posts.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}

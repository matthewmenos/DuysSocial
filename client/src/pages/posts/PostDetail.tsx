import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { Avatar } from "../../components/Icon";
import { PostCard, type Post } from "../../components/PostCard";

export function PostDetail() {
  const { id } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<{ id: number; body: string; author: { username: string; displayName: string; avatarUrl: string } }[]>([]);
  const [body, setBody] = useState("");
  const load = async () => {
    const p = await api(`/api/posts/${id}`);
    setPost(p.post);
    const c = await api(`/api/posts/${id}/comments`);
    setComments(c.comments);
  };
  useEffect(() => { load(); }, [id]);
  if (!post) return null;
  return (
    <div>
      <PostCard post={post} onChange={load} />
      <form onSubmit={async (e) => { e.preventDefault(); await api(`/api/posts/${id}/comment`, { method: "POST", body: JSON.stringify({ body }) }); setBody(""); load(); }}>
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Comment" />
      </form>
      {comments.map((c) => <div key={c.id} className="comment"><Avatar url={c.author?.avatarUrl} size={32} /> <strong>{c.author?.displayName}</strong> {c.body}</div>)}
    </div>
  );
}

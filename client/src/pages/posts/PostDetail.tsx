import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Avatar, Icon } from "../../components/Icon";
import { BusyButton } from "../../components/BusyButton";
import { useBusy } from "../../components/useBusy";
import { PostCard, type Post } from "../../components/PostCard";
import { PageLoading } from "../../components/PageState";

type Comment = {
  id: number;
  body: string;
  likeCount: number;
  createdAt: string;
  author: { username: string; displayName: string; avatarUrl: string; verifiedBadge: string } | null;
};

/** Mirrors DUYS/duys/templates/posts/detail.html. */
export function PostDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { boot } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const { busy: replying, run: runReply } = useBusy();

  const load = async () => {
    if (!id) return;
    try {
      const p = await api(`/api/posts/${id}`);
      setPost(p.post ?? null);
      const c = await api(`/api/posts/${id}/comments`);
      setComments(c.comments || []);
    } catch { /* post deleted */ }
  };

  useEffect(() => { void load(); }, [id]);

  function submitComment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    void runReply(async () => {
      try {
        await api(`/api/posts/${id}/comment`, { method: "POST", body: JSON.stringify({ body: text }) });
        setBody("");
        await load();
      } catch { /* keep the draft so the reply isn't lost */ }
    });
  }

  async function toggleLike(commentId: number) {
    await api(`/api/comments/${commentId}/like`, { method: "POST", body: "{}" }).catch(() => {});
    await load();
  }

  if (!post) return <PageLoading label="Loading post…" />;

  return (
    <>
      <div className="page-head glass-bar">
        <button className="icon-btn" onClick={() => nav(-1)} title="Back"><Icon name="arrow-left" size={20} /></button>
        <div className="page-head-info"><h1>Post</h1></div>
      </div>

      <div className="feed">
        <PostCard post={post} onChange={load} />
      </div>

      <form className="comment-compose" onSubmit={submitComment}>
        <Avatar url={boot?.user?.avatarUrl} size={36} alt={boot?.user?.displayName} />
        <input
          className="composer-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Post your reply"
          maxLength={500}
        />
        <BusyButton className="btn btn-primary" type="submit" busy={replying} busyLabel="Replying…" disabled={!body.trim()}>Reply</BusyButton>
      </form>

      <div className="comments">
        {comments.map((c) => (
          <div className="comment" key={c.id}>
            <Avatar url={c.author?.avatarUrl} size={36} alt={c.author?.displayName} />
            <div className="comment-main">
              <div className="comment-head">
                <strong>{c.author?.displayName}</strong>
                <span className="muted">@{c.author?.username}</span>
                <time className="muted small">{String(c.createdAt).slice(0, 10)}</time>
              </div>
              <p>{c.body}</p>
              <div className="comment-actions">
                <button className="action comment-like" onClick={() => void toggleLike(c.id)} title="Like comment">
                  <Icon name="heart" size={15} /> <span className="clike-count">{c.likeCount || ""}</span>
                </button>
                <button className="action comment-reply" onClick={() => nav(`/u/${c.author?.username}`)} title="Reply">
                  <Icon name="comment" size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {!comments.length && <div className="comment-empty muted">No replies yet. Be the first.</div>}
      </div>
    </>
  );
}


import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Avatar, Badge, Icon } from "./Icon";

export type Post = {
  id: number;
  authorId?: number;
  kind: string;
  body: string;
  title: string;
  isSponsored: boolean;
  isExclusive: boolean;
  unlocked: boolean;
  unlockPrice: number;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  viewCount?: number;
  liked: boolean;
  media: { url: string; kind: string }[];
  poll: { id: number; label: string; votes: number }[];
  votedOption: number | null;
  quote?: Post | null;
  preview?: { url: string; title: string; description: string; image: string; domain: string } | null;
  author: { id?: number; username: string; displayName: string; avatarUrl: string; verifiedBadge: string };
  createdAt: string;
  cta?: string;
  landingUrl?: string;
};

export function PostCard({ post, onChange }: { post: Post; onChange?: () => void }) {
  const { boot } = useAuth();
  const nav = useNavigate();
  const mine = boot?.user?.id === (post.authorId || post.author.id);
  const total = post.poll?.reduce((s, o) => s + o.votes, 0) || 0;

  return (
    <article className={`post-card post-clickable ${post.kind === "article" ? "post-card-article" : ""}`}>
      <div className="post-row">
        <Link className="post-avatar" to={`/u/${post.author.username}`}>
          <Avatar url={post.author.avatarUrl} size={40} alt={post.author.displayName} />
        </Link>
        <div className="post-main">
          <header className="post-head">
            <div className="post-id">
              <Link className="post-author" to={`/u/${post.author.username}`}>
                <span className="post-name">{post.author.displayName}</span>
                <Badge kind={post.author.verifiedBadge} />
              </Link>
              <span className="post-handle">@{post.author.username}</span>
              <time className="post-time">{String(post.createdAt).slice(0, 10)}</time>
              {post.kind === "article" && <span className="kind-tag kind-article">Article</span>}
              {post.isSponsored && <span className="kind-tag kind-sponsored">Promoted</span>}
            </div>
            <div className="post-head-actions">
              {!mine && (
                <button className="action action-tip" title="Tip" onClick={async (e) => {
                  e.stopPropagation();
                  const amt = Number(window.prompt("Tip amount (points)", "10") || "0");
                  if (!amt || !post.author.id) return;
                  await api("/api/wallet/tip", { method: "POST", body: JSON.stringify({ toId: post.author.id, amount: amt, currency: "points", postId: post.id }) });
                }}><span className="tip-gem">💎</span></button>
              )}
              {mine && (
                <button className="action action-boost" title="Boost" onClick={async (e) => {
                  e.stopPropagation();
                  const days = Number(window.prompt("Boost days", "1") || "0");
                  if (!days) return;
                  await api(`/api/boost/${post.id}`, { method: "POST", body: JSON.stringify({ days, cta: "Learn more" }) });
                  onChange?.();
                }}><Icon name="boost" size={17} /></button>
              )}
            </div>
          </header>
          {post.kind === "article" && post.title && <h2 className="post-title">{post.title}</h2>}
          {post.isExclusive && (
            <div className="post-exclusive-tag"><Icon name="star" size={12} /> Exclusive
              {post.unlockPrice > 0 ? ` · ${post.unlockPrice} DUYS` : ""}
            </div>
          )}
          {post.isExclusive && !post.unlocked ? (
            <div className="post-locked-overlay">
              <span className="post-locked-icon">🔒</span>
              <strong className="post-locked-title">Exclusive Content</strong>
              <p className="post-locked-sub">Unlock for {post.unlockPrice} DUYS</p>
              <button className="btn btn-primary btn-sm post-unlock-btn" onClick={() => api(`/api/posts/${post.id}/unlock`, { method: "POST", body: "{}" }).then(() => onChange?.())}>Unlock</button>
            </div>
          ) : (
            <>
              {post.body && <div className={`post-body ${post.kind === "article" ? "post-body-rich" : ""}`} style={{ whiteSpace: "pre-wrap" }}>{post.body}</div>}
              {post.media?.length === 1 && post.media[0].kind === "video" ? (
                <div className="post-video-wrap"><video src={post.media[0].url} preload="metadata" playsInline muted controls /></div>
              ) : post.media?.length ? (
                <div className={`post-media media-count-${post.media.length}`}>
                  {post.media.map((m) => m.kind === "video"
                    ? <video key={m.url} className="media-item" src={m.url} controls playsInline />
                    : <img key={m.url} className="media-item" src={m.url} alt="" />)}
                </div>
              ) : null}
              {post.preview && (
                <a className="link-card" href={post.preview.url} target="_blank" rel="noreferrer">
                  {post.preview.image && <span className="link-card-img" style={{ backgroundImage: `url(${post.preview.image})` }} />}
                  <span className="link-card-body">
                    <span className="link-card-domain">{post.preview.domain}</span>
                    <strong className="link-card-title">{post.preview.title || post.preview.url}</strong>
                  </span>
                </a>
              )}
              {post.quote && (
                <Link className="quote-embed" to={`/posts/${post.quote.id}`}>
                  <div className="quote-head">
                    <Avatar url={post.quote.author.avatarUrl} size={18} />
                    <strong>{post.quote.author.displayName}</strong>
                    <span className="muted">@{post.quote.author.username}</span>
                  </div>
                  {post.quote.body && <p className="quote-body">{post.quote.body.slice(0, 160)}</p>}
                </Link>
              )}
              {post.isSponsored && post.cta && post.landingUrl && (
                <a className="ad-cta" href={post.landingUrl} target="_blank" rel="noreferrer"><span className="ad-cta-label">{post.cta}</span></a>
              )}
              {post.poll?.length > 0 && (
                <div className="poll" data-voted={post.votedOption != null ? "yes" : "no"}>
                  {post.poll.map((o) => {
                    const pct = total ? Math.floor((o.votes / total) * 100) : 0;
                    return (
                      <button key={o.id} className={`poll-option ${post.votedOption === o.id ? "poll-mine" : ""}`}
                        disabled={post.votedOption != null}
                        onClick={() => api(`/api/posts/${post.id}/vote`, { method: "POST", body: JSON.stringify({ optionId: o.id }) }).then(() => onChange?.())}>
                        <span className="poll-fill" style={{ width: `${pct}%` }} />
                        <span className="poll-label">{o.label}</span>
                        <span className="poll-pct">{pct}%</span>
                      </button>
                    );
                  })}
                  <p className="poll-total">{total} votes</p>
                </div>
              )}
            </>
          )}
          <footer className="post-actions">
            <button className="action action-comment" title="Reply" onClick={() => nav(`/posts/${post.id}`)}>
              <Icon name="comment" size={18} /><span>{post.commentCount || ""}</span>
            </button>
            <button className="action action-repost" title="Repost" onClick={() => api(`/api/posts/${post.id}/repost`, { method: "POST", body: "{}" }).then(() => onChange?.())}>
              <Icon name="repost" size={18} /><span className="repost-count">{post.repostCount || ""}</span>
            </button>
            <button className={`action action-like ${post.liked ? "is-liked" : ""}`} title="Like"
              onClick={() => api(`/api/posts/${post.id}/like`, { method: "POST", body: "{}" }).then(() => onChange?.())}>
              <Icon name="heart" size={18} /><span className="like-count">{post.likeCount || ""}</span>
            </button>
            <span className="action action-views" title="Views"><Icon name="chart" size={18} /><span>{post.viewCount || ""}</span></span>
            <button className="action action-share" title="Share" onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`);
            }}><Icon name="share-out" size={18} /></button>
          </footer>
        </div>
      </div>
    </article>
  );
}

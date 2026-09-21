import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { Avatar, Icon } from "../../components/Icon";

type Notif = {
  id: number;
  text: string;
  kind: string;
  isRead: boolean;
  createdAt: string;
  entityId: number | null;
  entityType: string;
  actor: { username: string; displayName: string; avatarUrl: string } | null;
  post: { body: string; mediaUrl: string; mediaKind: string } | null;
};

const KIND_ICON: Record<string, string> = {
  like: "❤️", comment: "💬", follow: "👤", tip: "💰",
  message: "✉️", repost: "🔁", referral: "🎁", mention: "@", system: "🔔",
};
const KIND_CLASS: Record<string, string> = {
  like: "nk-like", comment: "nk-comment", follow: "nk-follow", tip: "nk-tip",
  message: "nk-message", repost: "nk-repost", referral: "nk-referral",
  mention: "nk-mention", system: "nk-system",
};
const BUCKETS: [string, string][] = [
  ["new", "New"],
  ["week", "This Week"],
  ["month", "This Month"],
  ["older", "Earlier"],
];

function bucketOf(ts: string) {
  const age = Date.now() - new Date(ts).getTime();
  const DAY = 86_400_000;
  if (age < DAY) return "new";
  if (age < 7 * DAY) return "week";
  if (age < 30 * DAY) return "month";
  return "older";
}

function humanTime(ts: string) {
  const age = Date.now() - new Date(ts).getTime();
  if (age < 60_000) return "just now";
  if (age < 3_600_000) return `${Math.floor(age / 60_000)}m`;
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)}h`;
  if (age < 7 * 86_400_000) return `${Math.floor(age / 86_400_000)}d`;
  if (age < 30 * 86_400_000) return `${Math.floor(age / (7 * 86_400_000))}w`;
  return `${Math.floor(age / (30 * 86_400_000))}mo`;
}

function target(n: Notif) {
  if ((n.kind === "like" || n.kind === "comment" || n.kind === "repost") && n.entityId) return `/posts/${n.entityId}`;
  if (n.kind === "message" && n.entityId) return `/messages/${n.entityId}`;
  if (n.actor) return `/u/${n.actor.username}`;
  return "/notifications";
}

/** Mirrors DUYS/duys/templates/notifications/index.html (ig-notif rows + buckets). */
export function NotificationsPage() {
  const [rows, setRows] = useState<Notif[]>([]);
  useEffect(() => {
    api("/api/notifications")
      .then((d) => {
        setRows(d.notifications || []);
        api("/api/notifications/read", { method: "POST", body: "{}" }).catch(() => {});
      })
      .catch(() => {});
  }, []);

  let lastBucket = "";

  return (
    <>
      <div className="page-head glass-bar"><h1>Notifications</h1></div>

      {rows.length > 0 ? (
        <div className="ig-notif-page">
          <div className="ig-notif-list stagger">
            {rows.map((n) => {
              const b = bucketOf(n.createdAt);
              const head = b !== lastBucket ? BUCKETS.find(([key]) => key === b)?.[1] : null;
              lastBucket = b;
              return (
                <span key={n.id}>
                  {head && <div className="ig-notif-section-head">{head}</div>}
                  <Link className={`ig-notif ${n.isRead ? "" : "unread"}`} to={target(n)}>
                    <div className="ig-notif-avatar-wrap">
                      {n.actor ? (
                        <Avatar url={n.actor.avatarUrl} size={44} alt={n.actor.displayName} />
                      ) : (
                        <span className="avatar avatar-fallback" style={{ width: 44, height: 44, fontSize: 20 }}>🔔</span>
                      )}
                      <span className={`ig-notif-kind-badge ${KIND_CLASS[n.kind] || "nk-system"}`}>
                        {KIND_ICON[n.kind] || "🔔"}
                      </span>
                    </div>
                    <div className="ig-notif-body">
                      <p className="ig-notif-text">
                        {n.actor && <strong>{n.actor.displayName}</strong>} {n.text}
                      </p>
                      <time className="ig-notif-time">{humanTime(n.createdAt)}</time>
                    </div>
                    <div className="ig-notif-right">
                      {n.post?.mediaUrl ? (
                        <div className="ig-notif-preview">
                          {n.post.mediaKind === "video" ? (
                            <>
                              <video src={n.post.mediaUrl} muted playsInline preload="none" className="ig-notif-preview-img" />
                              <span className="ig-notif-preview-play">▶</span>
                            </>
                          ) : (
                            <img src={n.post.mediaUrl} alt="" className="ig-notif-preview-img" decoding="async" />
                          )}
                        </div>
                      ) : n.post?.body ? (
                        <div className="ig-notif-preview ig-notif-preview-text">
                          <span>{n.post.body.slice(0, 40)}</span>
                        </div>
                      ) : !n.isRead ? (
                        <span className="ig-notif-dot" />
                      ) : null}
                    </div>
                  </Link>
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="ig-empty-state">
          <Icon name="bell" size={52} />
          <h3>Activity on your posts</h3>
          <p>When someone likes or comments on one of your posts, you'll see it here.</p>
        </div>
      )}
    </>
  );
}


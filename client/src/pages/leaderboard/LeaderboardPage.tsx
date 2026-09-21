import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Avatar, Badge, Icon } from "../../components/Icon";

type Row = {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  verifiedBadge: string;
  points: number;
};

/** Mirrors DUYS/duys/templates/leaderboard/index.html. */
export function LeaderboardPage() {
  const { boot } = useAuth();
  const [users, setUsers] = useState<Row[]>([]);
  useEffect(() => { api("/api/leaderboard").then((d) => setUsers(d.users || [])).catch(() => {}); }, []);

  const me = boot?.user;
  const myIdx = me ? users.findIndex((u) => u.username === me.username) : -1;
  const podium = users.slice(0, 3);
  const order = podium.length >= 3 ? [podium[1], podium[0], podium[2]] : [];
  const podRank = (i: number) => (i === 0 ? 2 : i === 1 ? 1 : 3);
  const medal = ["second", "first", "third"];

  return (
    <>
      <div className="page-head glass-bar"><h1>$DUYS Leaderboard</h1></div>

      <div className="lb-myrank card">
        <span className="muted">Your rank</span>
        <strong className="lb-rank-big">{myIdx >= 0 ? `#${myIdx + 1}` : "—"}</strong>
        <span className="lb-mypoints">{me?.points ?? 0} $DUYS</span>
      </div>

      {podium.length >= 3 && (
        <div className="lb-podium">
          {order.map((u, i) => (
            <Link className={`lb-pod lb-pod-${medal[i]}`} key={u.username} to={`/u/${u.username}`}>
              <span className="lb-pod-rank">{podRank(i)}</span>
              <Avatar url={u.avatarUrl} size={64} alt={u.displayName} />
              <strong>{u.displayName}<Badge kind={u.verifiedBadge} /></strong>
              <span className="muted">@{u.username}</span>
              <span className="lb-pod-points">{u.points}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="lb-list stagger">
        {users.map((u, i) => (
          <Link className={`lb-row ${me?.username === u.username ? "lb-me" : ""}`} key={u.username} to={`/u/${u.username}`}>
            <span className={`lb-rank ${i < 3 ? "top3" : ""}`}>{i + 1}</span>
            <Avatar url={u.avatarUrl} size={44} alt={u.displayName} />
            <div className="lb-info">
              <strong>{u.displayName}<Badge kind={u.verifiedBadge} /></strong>
              <span className="muted">@{u.username}</span>
            </div>
            <span className="lb-points"><Icon name="coins" size={16} /> {u.points}</span>
          </Link>
        ))}
        {!users.length && (
          <div className="empty-state"><Icon name="coins" size={48} /><h3>No rankings yet</h3></div>
        )}
      </div>
    </>
  );
}


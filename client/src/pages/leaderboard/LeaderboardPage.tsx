import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";

export function LeaderboardPage() {
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => { api("/api/leaderboard").then((d) => setUsers(d.users)); }, []);
  return (
    <div>
      <h2>Leaderboard</h2>
      <ol>{users.map((u) => <li key={u.id}><Link to={`/u/${u.username}`}>{u.displayName}</Link> · {u.points}</li>)}</ol>
    </div>
  );
}

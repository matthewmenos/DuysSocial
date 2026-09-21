import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { Avatar, Icon } from "../../components/Icon";

type Ref = { username: string; displayName: string; avatarUrl: string; createdAt: string };
type Data = { code: string; count: number; bonus: number; percent: number; earned: number; referees: Ref[] };

/** Mirrors DUYS/duys/templates/referral/index.html. */
export function ReferralPage() {
  const [data, setData] = useState<Data | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { api("/api/referral").then(setData).catch(() => {}); }, []);
  const link = `${window.location.origin}/auth/login?tab=signup&ref=${data?.code || ""}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  }

  return (
    <>
      <div className="page-head glass-bar"><h1>Referrals</h1></div>

      <div className="card referral-card">
        <h3>Invite friends, earn $DUYS</h3>
        <p className="muted">
          Earn <strong>{data?.bonus ?? 100}</strong> $DUYS per signup, plus{" "}
          <strong>{data?.percent ?? 1}%</strong> of everything they earn — forever.
        </p>
        <label className="ref-code-label">Your referral code</label>
        <div className="ref-code-box">
          <code>{link}</code>
          <button className="btn btn-primary" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
        </div>
        <p className="muted small">Your code is your username: <strong>@{data?.code}</strong></p>
      </div>

      <div className="earn-stats card">
        <div><strong>{data?.count ?? 0}</strong><span className="muted">referrals</span></div>
        <div><strong>{data?.earned ?? 0}</strong><span className="muted">$DUYS earned</span></div>
      </div>

      <h3 className="section-title">Your referrals</h3>
      <div className="user-list">
        {(data?.referees ?? []).map((r) => (
          <Link className="user-row" key={r.username} to={`/u/${r.username}`}>
            <Avatar url={r.avatarUrl} size={44} alt={r.displayName} />
            <div className="user-row-info">
              <strong>{r.displayName}</strong>
              <span className="muted">@{r.username} · joined {String(r.createdAt).slice(0, 10)}</span>
            </div>
          </Link>
        ))}
        {data && !data.referees.length && (
          <div className="empty-state">
            <Icon name="coins" size={48} />
            <h3>No referrals yet</h3>
            <p>Share your link to start earning.</p>
          </div>
        )}
      </div>
    </>
  );
}


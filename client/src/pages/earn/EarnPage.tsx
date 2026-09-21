import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Icon } from "../../components/Icon";

type View = { id: number; reward: number; createdAt: string };
type Wallet = {
  user: { points: number; walletAddress: string | null };
  claim: { pointsPerToken: number; minPoints: number };
  blockchainEnabled: boolean;
};

/** Mirrors DUYS/duys/templates/earn/index.html. */
export function EarnPage() {
  const { boot, refresh } = useAuth();
  const [views, setViews] = useState<View[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [reward, setReward] = useState(10);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api("/api/earn").then((d) => { setViews(d.views || []); setReward(d.reward ?? 10); }).catch(() => {});
    api("/api/wallet").then(setWallet).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const points = boot?.user?.points ?? 0;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const todayCount = views.filter((v) => new Date(v.createdAt) >= start).length;
  const totalEarned = views.reduce((sum, v) => sum + (v.reward || 0), 0);
  const rules = wallet?.claim ?? { pointsPerToken: 10, minPoints: 100 };
  const claimableTokens = Math.floor(points / rules.pointsPerToken);
  const progress = Math.min(100, Math.round((points / rules.minPoints) * 100));

  async function watchAd() {
    setBusy(true);
    try {
      await api("/api/earn/ad", { method: "POST", body: "{}" });
      await refresh();
      load();
    } catch { /* ignore */ } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head glass-bar"><h1>Earn / Airdrop</h1></div>

      <div className="earn-hero">
        <div className="earn-balance">
          <span className="muted">Your balance</span>
          <p className="wallet-amount">{points}</p>
          <span className="muted">$DUYS Points</span>
        </div>
        <div className="earn-stats">
          <div><strong>{todayCount}</strong><span className="muted">ads today</span></div>
          <div><strong>{totalEarned}</strong><span className="muted">total earned</span></div>
        </div>
      </div>

      <div className="card earn-ad">
        <h3>Watch an ad, earn {reward} $DUYS</h3>
        <p className="muted">Watch a short ad to claim your reward.</p>
        <button className="btn btn-primary btn-lg" onClick={watchAd} disabled={busy}>
          <Icon name="gift" size={20} /> {busy ? "Loading…" : "Watch ad & earn"}
        </button>
      </div>

      <div className="card earn-claim-card">
        <div className="earn-claim-header">
          <div>
            <h3><Icon name="coins" size={18} /> Convert Points → Real DUYS</h3>
            <p className="muted small">{rules.pointsPerToken} points = 1 DUYS token on BSC</p>
          </div>
          {claimableTokens > 0 && <span className="claim-stat-token">{claimableTokens}</span>}
        </div>

        {!wallet?.blockchainEnabled && (
          <p className="muted small">Token redemption is coming soon — keep earning points!</p>
        )}
        {wallet?.blockchainEnabled && !wallet.user.walletAddress && (
          <p className="muted small">
            <Icon name="wallet" size={14} />{" "}
            <Link to="/wallet" className="link-mention">Link your BSC wallet</Link> to redeem points as real tokens.
          </p>
        )}
        {wallet?.blockchainEnabled && Boolean(wallet.user.walletAddress) && points < rules.minPoints && (
          <div className="earn-claim-progress">
            <div className="earn-claim-bar">
              <div className="earn-claim-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="muted small">{points} / {rules.minPoints} pts to unlock</span>
          </div>
        )}
        {wallet?.blockchainEnabled && Boolean(wallet.user.walletAddress) && points >= rules.minPoints && (
          <Link className="btn btn-primary" to="/wallet/claim">
            <Icon name="send" size={16} /> Claim {claimableTokens} DUYS now →
          </Link>
        )}
      </div>
    </>
  );
}


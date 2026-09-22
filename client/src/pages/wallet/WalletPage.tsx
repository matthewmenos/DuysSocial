import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { Icon } from "../../components/Icon";
import { BusyButton } from "../../components/BusyButton";
import { useBusy } from "../../components/useBusy";
import { PageError, PageLoading } from "../../components/PageState";
import { PasswordField } from "../../components/PasswordField";

interface WalletData {
  user: {
    points: number;
    duysTokens: number;
    balanceCents: number;
    walletAddress: string | null;
  };
  txs: any[];
  ledger: Array<{
    id: number;
    reason: string;
    delta: number;
    is_token?: boolean;
    created_at: string;
  }>;
  claims: Array<{
    id: number;
    tokensAmount: number;
    pointsSpent: number;
    txHash: string | null;
    status: "confirmed" | "pending" | "failed";
    createdAt: string;
  }>;
  ice: any[];
  walletConnectId: string;
  blockchainEnabled: boolean;
  claim: {
    pointsPerToken: number;
    minPoints: number;
  };
}

export function WalletPage() {
  const nav = useNavigate();
  const [data, setData] = useState<WalletData | null>(null);
  const [hide, setHide] = useState(false);
  const { busy: linking, run: runLink } = useBusy();
  const { busy: unlinking, run: runUnlink } = useBusy();
  const { busy: claiming, run: runClaim } = useBusy();
  const [err, setErr] = useState("");
  const [loadErr, setLoadErr] = useState("");
  const [claimPassword, setClaimPassword] = useState("");
  const load = () => api("/api/wallet")
    .then((d) => { setData(d as WalletData); setLoadErr(""); })
    .catch((ex) => setLoadErr((ex as Error).message || "Could not load your wallet."));
  useEffect(() => { void load(); }, []);
  if (loadErr) return <PageError message={loadErr} onRetry={() => void load()} />;
  if (!data) return <PageLoading label="Loading wallet…" />;
  const tokens = data.user.duysTokens;
  const address: string | null = data.user.walletAddress || null;
  const canClaim = data.blockchainEnabled && address && data.user.points >= data.claim.minPoints;

  function connectWallet() {
    setErr("");
    void runLink(async () => {
      try {
        const eth = window.ethereum;
        if (!eth) throw new Error("No wallet detected. Install MetaMask.");
        const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
        const account = accounts?.[0];
        if (!account) throw new Error("No account selected.");
        const { nonce } = await api("/api/wallet/connect/nonce", { method: "POST", body: "{}" });
        const signature = (await eth.request({
          method: "personal_sign",
          params: [nonce, account],
        })) as string;
        await api("/api/wallet/connect/verify", {
          method: "POST",
          body: JSON.stringify({ address: account, signature }),
        });
        await load();
      } catch (ex) {
        setErr((ex as Error).message || "Could not connect wallet.");
      }
    });
  }

  function disconnectWallet() {
    setErr("");
    void runUnlink(async () => {
      try {
        await api("/api/wallet/disconnect", { method: "POST", body: "{}" });
        await load();
      } catch (ex) {
        setErr((ex as Error).message);
      }
    });
  }

  function claimRewards() {
    setErr("");
    void runClaim(async () => {
      try {
        await api("/api/claim-rewards", {
          method: "POST",
          body: JSON.stringify({ password: claimPassword }),
        });
        await load();
        setClaimPassword("");
      } catch (ex) {
        const e = ex as Error & { data?: { error?: string } };
        setErr(e.data?.error || e.message || "Claim failed.");
      }
    });
  }

  function ledgerLabel(reason: string): string {
    const map: Record<string, string> = {
      tip: "Sent DUYS tip",
      tip_received: "Received DUYS tip",
      tip_live: "Live tip sent",
      tip_live_received: "Live tip received",
      boost: "Post boosted",
      verification_fee: "Verification fee",
      badge_renewal: "Badge renewal",
      transfer: "On-chain transfer in",
      swap_buy: "Swap — bought DUYS",
      swap_sell: "Swap — sold DUYS",
      token_claim: "Claimed to on-chain",
      token_claim_refund: "Claim refunded",
      referral_earn_cut: "Referral bonus",
    };
    return map[reason] || reason.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  }

  function ledgerIcon(reason: string): string | null {
    if (reason.includes("ad")) return "video";
    if (reason.includes("tip")) return "gift";
    if (reason.includes("boost")) return "boost";
    if (reason.includes("verification") || reason.includes("badge")) return "checkmark";
    if (reason.includes("transfer") || reason.includes("swap")) return "repost";
    if (reason.includes("referral") || reason.includes("referral")) return "star";
    return null;
  }

  return (
    <>
      <div className="wlt-topbar">
        <span className="wlt-topbar-title">Wallet</span>
        <a href="#claim-history" className="wlt-history-btn"><Icon name="chart" size={16} /> History
          {data.claims && data.claims.length > 0 && <span className="wlt-history-badge">{data.claims.length}</span>}
        </a>
      </div>

      {/* ── $DUYS Token card ── */}
      <div className="wlt-card wlt-token-card">
        <div className="wlt-card-row">
          <div>
            <div className="wlt-card-title">$DUYS Token</div>
            <div className="wlt-card-sub">Spendable balance</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {address ? (
              <BusyButton className="btn btn-sm" busy={unlinking} busyLabel="Disconnecting…" onClick={disconnectWallet}>Disconnect</BusyButton>
            ) : (
              <BusyButton className="btn btn-primary btn-sm" busy={linking} busyLabel="Connecting…" onClick={connectWallet}>Connect Wallet</BusyButton>
            )}
            <span className="wlt-badge-pill">TOKEN</span>
          </div>
        </div>

        <button className="wlt-eye-btn" onClick={() => setHide(!hide)} aria-label="Show/hide balance">
          <Icon name={hide ? "eye-off" : "eye"} size={18} />
        </button>

        <div className="wlt-balance-row">
          <span className="wlt-balance-amt">{hide ? "••••" : tokens}</span>
          <span className="wlt-balance-unit">DUYS</span>
        </div>
        <div className="wlt-balance-usd">≈ <span id="wlt-usd-val">…</span> USDT</div>

        {address && (
          <div className="wlt-onchain-row">
            <span className="wlt-muted">On-chain balance (linked)</span>
            <span className="wlt-onchain-amt">—</span>
          </div>
        )}

        <div className="wlt-actions">
          <button className="wlt-action" onClick={() => nav("/wallet/swap")}><span className="wlt-action-icon wlt-action-solid"><Icon name="plus" size={20} /></span><span>Buy</span></button>
          <button className="wlt-action" onClick={() => nav("/wallet/swap")}><span className="wlt-action-icon wlt-action-solid"><Icon name="boost" size={20} /></span><span>Sell</span></button>
          <button className="wlt-action" onClick={() => nav("/wallet/claim")}><span className="wlt-action-icon wlt-action-outline"><Icon name="send" size={20} /></span><span>Claim</span></button>
          {address && (
            <button className="wlt-action" onClick={() => nav("/wallet/swap")}>
              <span className="wlt-action-icon wlt-action-outline"><Icon name="repost" size={20} /></span><span>Transfer</span>
            </button>
          )}
        </div>

        <p className="wlt-card-footer">Spend for tips, boosts, sells and more.</p>
      </div>

      {/* ── DUYS Earnings card ── */}
      <div className="wlt-card wlt-earn-card">
        <div className="wlt-card-row">
          <div>
            <div className="wlt-card-title">DUYS Earnings</div>
            <div className="wlt-card-sub">Unrealized Balance</div>
          </div>
          <span className="wlt-badge-pill wlt-badge-earn">EARNINGS</span>
        </div>

        <button className="wlt-eye-btn" onClick={() => setHide(!hide)} aria-label="Show/hide earnings">
          <Icon name={hide ? "eye-off" : "eye"} size={18} />
        </button>

        <div className="wlt-earn-balance">
          <span className="wlt-earn-amt">{hide ? "••••" : data.user.points}</span>
          <span className="wlt-earn-unit">pts</span>
        </div>

        <div className="wlt-earn-pills">
          <span className="wlt-earn-pill">Pending: <strong>0</strong></span>
          <span className="wlt-earn-pill">Burned: <strong>0</strong></span>
        </div>

        {data.user.points < data.claim.minPoints && (
          <div className="wlt-earn-progress-block">
            <div className="wlt-earn-bar">
              <div className="wlt-earn-fill" style={{ width: `${Math.min((data.user.points / data.claim.minPoints) * 100, 100)}%` }} />
            </div>
            <div className="wlt-earn-meta">
              <span>{data.user.points} / {data.claim.minPoints} pts needed to claim</span>
            </div>
          </div>
        )}

        <a className="wlt-cta-btn wlt-cta-mine" href="/earn">
          <span className="wlt-cta-icon"><Icon name="fire" size={20} /></span>
          <div className="wlt-cta-text">
            <strong>Go Mining</strong>
            <span>Earn DUYS by running an active mining session</span>
          </div>
          <span className="wlt-cta-arrow"><Icon name="chevron" size={18} /></span>
        </a>

        <a className="wlt-cta-btn wlt-cta-campaign">
          <span className="wlt-cta-icon"><Icon name="star" size={20} /></span>
          <div className="wlt-cta-text">
            <strong>Campaigns</strong>
            <span>Complete missions for bonus rewards</span>
          </div>
          <span className="wlt-cta-arrow"><Icon name="chevron" size={18} /></span>
        </a>
      </div>

      {/* ── Token Metrics card ── */}
      <div className="wlt-card wlt-metrics-card" id="wlt-metrics">
        <div className="wlt-card-row">
          <div className="wlt-card-title">Token Metrics</div>
          <span className="wlt-badge-pill wlt-badge-metrics">METRICS</span>
        </div>
        <div className="wlt-metrics-price-row">
          <span className="wlt-price-label">Current Price</span>
        </div>
        <div className="wlt-price-row">
          <span className="wlt-price-amt" id="wlt-price">—</span>
          <span className="wlt-price-pair">USDT / DUYS</span>
        </div>
        <div className="wlt-price-change-row">
          <span className="wlt-price-change" id="wlt-price-change">—</span>
          <span className="wlt-price-period">24h</span>
        </div>
        <div className="wlt-metrics-footer">
          <div className="wlt-metrics-item">
            <span className="wlt-metrics-label">Max Supply</span>
            <strong className="wlt-metrics-val">100M <span className="wlt-metrics-unit">DUYS</span></strong>
          </div>
        </div>
      </div>

      {/* ── Invite code row ── */}
      <div className="wlt-card wlt-invite-row">
        <span className="wlt-invite-label">Invite code: <strong>{data.user.points}</strong></span>
        <div className="wlt-invite-right">
          <span className="wlt-referral-count" id="wlt-ref-count">— referrals</span>
          <button className="wlt-copy-invite" id="wlt-copy-invite" title="Copy invite code">
            <Icon name="paperclip" size={16} />
          </button>
        </div>
      </div>

      {/* ── Claim card ── */}
      {canClaim && (
        <div className="wlt-card claim-card" id="claim-card">
          <div className="wlt-section-label">Claim DUYS Tokens</div>
          <div className="wlt-claim-summary">
            <div className="wlt-claim-col">
              <span className="wlt-claim-big" id="claimable-pts">{data.user.points}</span>
              <span className="wlt-claim-sub">points</span>
            </div>
            <div className="wlt-claim-arrow">→</div>
            <div className="wlt-claim-col">
              <span className="wlt-claim-big wlt-claim-teal" id="claimable-tok">
                {Math.floor(data.user.points / data.claim.pointsPerToken)}
              </span>
              <span className="wlt-claim-sub">DUYS tokens</span>
            </div>
          </div>

          <PasswordField
            label="Password (for rewards)"
            value={claimPassword}
            onChange={setClaimPassword}
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <BusyButton
            className="wlt-claim-btn"
            busy={claiming}
            busyLabel="Claiming…"
            disabled={!claimPassword.trim()}
            onClick={claimRewards}
          >
            <Icon name="checkmark" size={18} /> Claim
          </BusyButton>
        </div>
      )}

      {!data.blockchainEnabled && (
        <div className="wlt-card claim-card">
          <div className="wlt-notice wlt-notice-warn"><Icon name="settings" size={16} /> On-chain claims are coming soon. Points are safely accumulated.</div>
        </div>
      )}

      {/* ── Claim History ── */}
      {data.claims && data.claims.length > 0 && (
        <>
          <div className="wlt-section-label wlt-section-pad" id="claim-history">Claim History</div>
          <div className="wlt-card wlt-tx-card">
            {data.claims.map((c) => (
              <div key={c.id} className="wlt-tx-row">
                <div className="wlt-tx-icon wlt-tx-icon-claim"><Icon name="checkmark" size={16} /></div>
                <div className="wlt-tx-info">
                  <span className="wlt-tx-label">{c.tokensAmount} DUYS <span className="wlt-tx-sub">({c.pointsSpent} pts)</span></span>
                  {c.txHash && c.status === "confirmed" && (
                    <a className="wlt-tx-hash" href={`https://bscscan.com/tx/${c.txHash}`} target="_blank" rel="noopener">{c.txHash.slice(0, 16)}…</a>
                  )}
                  {c.status === "pending" && <span className="wlt-tx-pending">Processing…</span>}
                  {c.status === "failed" && <span className="wlt-tx-failed">Failed — points restored</span>}
                </div>
                <div className="wlt-tx-right">
                  <span className={`wlt-badge wlt-badge-${c.status}`}>{c.status.charAt(0).toUpperCase() + c.status.slice(1)}</span>
                  <time className="wlt-tx-time">{new Date(c.createdAt).toISOString().slice(0, 10)}</time>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Activity ledger ── */}
      <div className="wlt-section-label wlt-section-pad">Activity</div>
      <div className="wlt-card wlt-tx-card">
        {data.ledger && data.ledger.length > 0 ? data.ledger.slice(0, 12).map((l) => (
          <div key={l.id} className="wlt-tx-row">
            <div className={`wlt-tx-icon ${l.delta > 0 ? "wlt-tx-icon-in" : "wlt-tx-icon-out"}`}>
              {ledgerIcon(l.reason) ? <Icon name={ledgerIcon(l.reason)!} size={16} /> : (l.delta > 0 ? "▲" : "▼")}
            </div>
            <div className="wlt-tx-info">
              <span className="wlt-tx-label">{ledgerLabel(l.reason)}</span>
              <time className="wlt-tx-sub">{new Date(l.created_at).toISOString().slice(0, 16).replace("T", " ")}</time>
            </div>
            <span className={`wlt-tx-amount ${l.delta > 0 ? "pos" : "neg"}`}>
              {l.is_token
                ? (l.delta > 0 ? "+" : "") + l.delta.toFixed(4) + " DUYS"
                : (l.delta > 0 ? "+" : "") + l.delta + " pts"}
            </span>
          </div>
        )) : (
          <p className="wlt-empty">No activity yet.</p>
        )}
      </div>
    </>
  );
}

import { useEffect, useState, useCallback } from "react";
import { api } from "../../api";
import { BusyButton } from "../../components/BusyButton";
import { useBusy } from "../../components/useBusy";

interface WalletState {
  address: string | null;
  connecting: boolean;
  error: string | null;
}

interface ClaimResult {
  ok: boolean;
  txHash: string | null;
  tokens: number;
  pointsSpent: number;
  to: string;
}

export function ClaimDUYS() {
  const [points, setPoints] = useState<number | null>(null);
  const [rules, setRules] = useState({ pointsPerToken: 10, minPoints: 100 });
  const [wallet, setWallet] = useState<WalletState>({ address: null, connecting: false, error: null });
  const { busy: linking, run: runLink } = useBusy();
  const { busy: claiming, run: runClaim } = useBusy();
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPoints = useCallback(async () => {
    try {
      const data = await api("/api/wallet");
      // `points` is the authoritative balance (pointsBalance is a legacy column).
      setPoints(data.user.points ?? 0);
      setRules({
        pointsPerToken: data.claim?.pointsPerToken ?? 10,
        minPoints: data.claim?.minPoints ?? 100,
      });
    } catch { /* not logged in */ }
  }, []);

  useEffect(() => { loadPoints(); }, [loadPoints]);

  const connectWallet = useCallback(() => {
    setWallet({ address: null, connecting: true, error: null });
    void runLink(async () => {
      try {
        const eth = window.ethereum;
        if (!eth) {
          setWallet({ address: null, connecting: false, error: "No wallet detected. Install MetaMask." });
          return;
        }
        const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
        setWallet({ address: accounts[0] ?? null, connecting: false, error: null });
      } catch (err) {
        setWallet({ address: null, connecting: false, error: (err as Error).message || "Connection rejected." });
      }
    });
  }, [runLink]);

  const handleClaim = useCallback(() => {
    setError(null);
    setResult(null);
    void runClaim(async () => {
      try {
        const payload: Record<string, unknown> = {};
        if (wallet.address) payload.toAddress = wallet.address;
        const data = await api("/api/claim-rewards", { method: "POST", body: JSON.stringify(payload) });
        setResult({ ok: true, txHash: data.txHash ?? null, tokens: data.tokens ?? 0, pointsSpent: data.pointsSpent ?? 0, to: data.to ?? wallet.address ?? "" });
        await loadPoints();
      } catch (err) {
        const e = err as Error & { data?: { error?: string; detail?: string; min?: number; have?: number; max?: number } };
        const d = e.data;
        if (d?.error === "below_min") setError(`You need at least ${d.min} points. You have ${d.have}.`);
        else if (d?.error === "daily_limit") setError(`Daily claim limit reached (${d.max ?? 1} per day). Try again tomorrow.`);
        else if (d?.error === "chain_failed") setError(`Chain failed: ${d.detail ?? "unknown"}. Points restored.`);
        else if (d?.error === "blockchain_disabled") setError("Blockchain rewards are temporarily disabled.");
        else if (d?.error === "bad_address") setError("Connect a valid wallet or provide a 0x address.");
        else if (d?.error === "wallet_taken") setError("That wallet is already linked to another account.");
        else setError(e.message || "Claim failed. Try again.");
      }
    });
  }, [wallet.address, loadPoints, runClaim]);

  const estimatedTokens = points != null ? Math.floor(points / rules.pointsPerToken) : 0;
  const canClaim = points != null && points >= rules.minPoints;

  return (
    <div className="claim-duys">
      <div className="claim-duys-card">
        <h2 className="claim-duys-title">Claim $DUYS Tokens</h2>
        <p className="claim-duys-subtitle">Convert earned points to on-chain DUYS tokens on BSC Testnet.</p>
        <div className="claim-duys-balance-row">
          <div className="claim-duys-balance">
            <span className="claim-duys-balance-label">Unclaimed Points</span>
            <span className="claim-duys-balance-value">{points != null ? points.toLocaleString() : "…"}</span>
          </div>
          <div className="claim-duys-balance">
            <span className="claim-duys-balance-label">Estimated DUYS</span>
            <span className="claim-duys-balance-value">{estimatedTokens.toLocaleString()}</span>
          </div>
        </div>
        <div className="claim-duys-wallet">
          {wallet.address ? (
            <div className="claim-duys-wallet-connected">
              <span className="claim-duys-wallet-dot" />
              <span className="claim-duys-wallet-address">{wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}</span>
            </div>
          ) : (
            <BusyButton className="btn btn-secondary btn-sm" busy={linking} busyLabel="Connecting…" onClick={connectWallet}>Connect Wallet</BusyButton>
          )}
          {wallet.error && <p className="claim-duys-error">{wallet.error}</p>}
        </div>
        <BusyButton className="btn btn-primary claim-duys-claim-btn" busy={claiming} busyLabel="Claiming…" onClick={handleClaim} disabled={!canClaim}>
          {canClaim ? `Claim ${estimatedTokens} DUYS` : `Need ${rules.minPoints} points to claim`}
        </BusyButton>
        {result && result.ok && (
          <div className="claim-duys-success">
            <strong>Claim successful!</strong>
            <p>{result.tokens} DUYS sent to {result.to.slice(0, 6)}…{result.to.slice(-4)}</p>
            {result.txHash && (
              <a className="claim-duys-tx-link" href={`https://testnet.bscscan.com/tx/${result.txHash}`} target="_blank" rel="noopener noreferrer">
                View on BSCScan
              </a>
            )}
          </div>
        )}
        {error && <p className="claim-duys-error claim-duys-error-block">{error}</p>}
      </div>
    </div>
  );
}

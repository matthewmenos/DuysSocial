import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { Icon } from "../../components/Icon";
import { BusyButton } from "../../components/BusyButton";
import { useBusy } from "../../components/useBusy";
import { PageError, PageLoading } from "../../components/PageState";

export function WalletPage() {
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [hide, setHide] = useState(false);
  const { busy: linking, run: runLink } = useBusy();
  const { busy: unlinking, run: runUnlink } = useBusy();
  const [err, setErr] = useState("");
  const [loadErr, setLoadErr] = useState("");
  const load = () => api("/api/wallet")
    .then((d) => { setData(d); setLoadErr(""); })
    .catch((ex) => setLoadErr((ex as Error).message || "Could not load your wallet."));
  useEffect(() => { void load(); }, []);
  if (loadErr) return <PageError message={loadErr} onRetry={() => void load()} />;
  if (!data) return <PageLoading label="Loading wallet…" />;
  const tokens = data.user.duysTokens;
  const address: string | null = data.user.walletAddress || null;

  /**
   * Link a wallet properly: the server issues a one-time nonce and the wallet signs
   * it, so the signature proves ownership of the address before it is stored.
   */
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

  return (
    <>
      <div className="wlt-topbar">
        <span className="wlt-topbar-title">Wallet</span>
        <a href="#claim-history" className="wlt-history-btn"><Icon name="chart" size={16} /> History
          {data.claims?.length > 0 && <span className="wlt-history-badge">{data.claims.length}</span>}
        </a>
      </div>
      <div className="wlt-card wlt-token-card">
        <div className="wlt-card-row">
          <div>
            <div className="wlt-card-title">$DUYS Token</div>
            <div className="wlt-card-sub">Spendable balance</div>
          </div>
          <span className="wlt-badge-pill">TOKEN</span>
        </div>
        <button className="wlt-eye-btn" onClick={() => setHide(!hide)}><Icon name={hide ? "eye-off" : "eye"} size={18} /></button>
        <div className="wlt-balance-row">
          <span className="wlt-balance-amt">{hide ? "••••" : tokens}</span>
          <span className="wlt-balance-unit">DUYS</span>
        </div>
        <div className="wlt-actions">
          <button className="wlt-action" onClick={() => nav("/wallet/swap")}><span className="wlt-action-icon wlt-action-solid"><Icon name="plus" size={20} /></span><span>Buy</span></button>
          <button className="wlt-action" onClick={() => nav("/wallet/swap")}><span className="wlt-action-icon wlt-action-solid"><Icon name="boost" size={20} /></span><span>Sell</span></button>
          <button className="wlt-action" onClick={() => nav("/wallet/claim")}><span className="wlt-action-icon wlt-action-outline"><Icon name="send" size={20} /></span><span>Claim</span></button>
        </div>
        <div className="wlt-connect-form">
          {address ? (
            <>
              <span className="wlt-connected">{address.slice(0, 6)}…{address.slice(-4)}</span>
              <BusyButton className="btn btn-sm" busy={linking} busyLabel="Relinking…" onClick={connectWallet}>Relink</BusyButton>
              <BusyButton className="btn btn-sm btn-outline" busy={unlinking} busyLabel="Disconnecting…" onClick={disconnectWallet}>Disconnect</BusyButton>
            </>
          ) : (
            <BusyButton className="btn btn-primary btn-sm" busy={linking} busyLabel="Connecting…" onClick={connectWallet}>Connect Wallet</BusyButton>
          )}
        </div>
        {err && <p className="flash flash-error">{err}</p>}
      </div>
      <div className="wlt-card" id="claim-history">
        <div className="wlt-card-title">Points</div>
        <p>{data.user.points} pts</p>
        {data.ledger?.slice(0, 12).map((l: any) => (
          <div key={l.id} className="wlt-tx-row"><span>{l.reason}</span><span>{l.delta > 0 ? "+" : ""}{l.delta}</span></div>
        ))}
      </div>
    </>
  );
}

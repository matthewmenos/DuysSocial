import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { Icon } from "../../components/Icon";

export function WalletPage() {
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [hide, setHide] = useState(false);
  const load = () => api("/api/wallet").then(setData);
  useEffect(() => { load(); }, []);
  if (!data) return null;
  const tokens = data.user.duysTokens;
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
          <button className="wlt-action" onClick={async () => { await api("/api/wallet/claim-tokens", { method: "POST", body: JSON.stringify({}) }); load(); }}><span className="wlt-action-icon wlt-action-outline"><Icon name="send" size={20} /></span><span>Claim</span></button>
        </div>
        <form className="wlt-connect-form" onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          await api("/api/wallet/connect/verify", { method: "POST", body: JSON.stringify({ address: fd.get("address") }) });
          load();
        }}>
          <input name="address" placeholder="0x… wallet address" defaultValue={data.user.walletAddress} />
          <button className="btn btn-primary btn-sm">Connect Wallet</button>
        </form>
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

import React, { useEffect, useState } from "react";
import { api } from "../../api";

export function SwapPage() {
  const [cfg, setCfg] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const loadCfg = () => api("/api/swap/config").then(setCfg);
  useEffect(() => { loadCfg(); }, []);

  async function start(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(""); setMsg("");
    const fd = new FormData(e.currentTarget);
    const side = String(fd.get("side"));
    const fromAmount = Number(fd.get("fromAmount"));
    try {
      const q = await api("/api/swap/quote", { method: "POST", body: JSON.stringify({ side, fromAmount }) });
      const started = await api("/api/swap/start", { method: "POST", body: JSON.stringify({ side, fromAmount }) });
      setState({ quote: q, swap: started.swap });
    } catch (ex) { setErr((ex as Error).message); }
  }

  async function confirm() {
    setErr("");
    if (!state) return;
    try {
      if (state.swap.side === "buy") {
        await api("/api/swap/confirm", { method: "POST", body: JSON.stringify({ swapId: state.swap.id }) });
        setMsg(`Confirmed — ${state.quote.toAmount.toFixed(4)} DUYS credited.`);
      } else {
        const txHash = window.prompt("Paste the USDT deposit tx hash to the vault") || "";
        if (!txHash) return;
        await api("/api/swap/deposit", { method: "POST", body: JSON.stringify({ swapId: state.swap.id, txHash }) });
        await api("/api/swap/confirm", { method: "POST", body: JSON.stringify({ swapId: state.swap.id }) });
        setMsg("Sell confirmed — USDT payout scheduled.");
      }
      setState(null);
      loadCfg();
    } catch (ex) { setErr((ex as Error).message); }
  }

  return (
    <div>
      <h2>Swap</h2>
      <p>Vault {cfg?.vault} · mid {cfg?.mid ? Number(cfg.mid).toFixed(4) : "…"} DUYS/USDT</p>
      {!state && (
        <form onSubmit={start}>
          <select name="side" defaultValue="buy">
            <option value="buy">Buy DUYS (USDT→DUYS)</option>
            <option value="sell">Sell DUYS (DUYS→USDT)</option>
          </select>
          <input name="fromAmount" type="number" step="0.01" min={cfg?.minUsdt || 0} placeholder="Amount" />
          <button className="btn btn-primary">Quote & start</button>
        </form>
      )}
      {state && (
        <div>
          <p>Rate {state.quote.rate.toFixed(4)} · You get <strong>{state.quote.toAmount.toFixed(4)}</strong></p>
          <p>{state.swap.side === "sell" ? `Send ${state.swap.fromAmount} DUYS to ${cfg?.vault} then confirm below.` : "Confirm to credit your wallet."}</p>
          <button className="btn btn-primary" onClick={confirm}>Confirm swap</button>
        </div>
      )}
      {msg && <p className="flash flash-success">{msg}</p>}
      {err && <p className="flash flash-error">{err}</p>}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { api } from "../../api";
import { BusyButton } from "../../components/BusyButton";
import { useBusy } from "../../components/useBusy";

export function SwapPage() {
  const [cfg, setCfg] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const { busy: quoting, run: runQuote } = useBusy();
  const { busy: confirming, run: runConfirm } = useBusy();
  const loadCfg = () => api("/api/swap/config").then(setCfg);
  useEffect(() => { loadCfg(); }, []);

  function start(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(""); setMsg("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const side = String(fd.get("side"));
    const fromAmount = Number(fd.get("fromAmount"));
    void runQuote(async () => {
      try {
        const q = await api("/api/swap/quote", { method: "POST", body: JSON.stringify({ side, fromAmount }) });
        const started = await api("/api/swap/start", { method: "POST", body: JSON.stringify({ side, fromAmount }) });
        setState({ quote: q, swap: started.swap });
      } catch (ex) { setErr((ex as Error).message); }
    });
  }

  function confirm() {
    setErr("");
    if (!state) return;
    void runConfirm(async () => {
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
    });
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
          <BusyButton className="btn btn-primary" type="submit" busy={quoting} busyLabel="Quoting…">Quote & start</BusyButton>
        </form>
      )}
      {state && (
        <div>
          <p>Rate {state.quote.rate.toFixed(4)} · You get <strong>{state.quote.toAmount.toFixed(4)}</strong></p>
          <p>{state.swap.side === "sell" ? `Send ${state.swap.fromAmount} DUYS to ${cfg?.vault} then confirm below.` : "Confirm to credit your wallet."}</p>
          <BusyButton className="btn btn-primary" busy={confirming} busyLabel="Confirming…" onClick={confirm}>Confirm swap</BusyButton>
        </div>
      )}
      {msg && <p className="flash flash-success">{msg}</p>}
      {err && <p className="flash flash-error">{err}</p>}
    </div>
  );
}

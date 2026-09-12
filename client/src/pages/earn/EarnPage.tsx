import { useEffect, useState } from "react";
import { api } from "../../api";

export function EarnPage() {
  const [data, setData] = useState<any>(null);
  const load = () => api("/api/earn").then(setData);
  useEffect(() => { load(); }, []);
  return (
    <div>
      <h2>Earn / Airdrop</h2>
      <p>Watch an ad for {data?.reward} $DUYS points.</p>
      <button className="btn btn-primary" onClick={async () => { await api("/api/earn/ad", { method: "POST", body: "{}" }); load(); }}>Watch ad</button>
    </div>
  );
}

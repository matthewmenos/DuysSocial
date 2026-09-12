import { api } from "../../api";
import { useAdmin } from "./useAdmin";

export function AdminBlockchain() {
  const { data, load } = useAdmin("/api/admin/blockchain");
  return (
    <div>
      <h1>Blockchain <button className="btn btn-sm" onClick={load}>Refresh</button></h1>
      {data && <p className="muted">Vault {data.vault} · Enabled {data.enabled ? "yes" : "no"}</p>}
      {!data?.claims?.length && <p className="muted">No claims yet.</p>}
      {data?.claims?.map((c: any) => (
        <div key={c.id} className="admin-row">
          <div>#{c.id} · user {c.userId} · {c.tokensAmount} DUYS · {c.status}</div>
          <code style={{ fontSize: 11 }}>{c.toAddress}</code>
          <button className="btn btn-sm btn-danger" onClick={() => api(`/api/admin/blockchain/claims/${c.id}/void`, { method: "POST", body: "{}" }).then(load)}>Void</button>
        </div>
      ))}
    </div>
  );
}

import { api } from "../../api";
import { useAdmin } from "./useAdmin";

export function AdminFinance() {
  const { data, load } = useAdmin("/api/admin/finance");
  return (
    <div>
      <h1>Finance <button className="btn btn-sm" onClick={load}>Refresh</button></h1>
      {!data?.txs?.length && <p className="muted">No transactions yet.</p>}
      {data?.txs?.map((t: any) => (
        <div key={t.id} className="admin-row">
          <div>#{t.id} · user {t.userId} · {t.amount} · {t.status}</div>
          <div>
            <button className="btn btn-sm" onClick={() => api(`/api/admin/finance/${t.id}/approve`, { method: "POST", body: "{}" }).then(load)}>Approve</button>
            <button className="btn btn-sm btn-danger" onClick={() => api(`/api/admin/finance/${t.id}/reject`, { method: "POST", body: "{}" }).then(load)}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

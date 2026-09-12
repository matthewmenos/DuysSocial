import { api } from "../../api";
import { useAdmin } from "./useAdmin";

export function AdminReports() {
  const { data, load } = useAdmin("/api/admin/reports");
  return (
    <div>
      <h1>Reports <button className="btn btn-sm" onClick={load}>Refresh</button></h1>
      {!data?.reports?.length && <p className="muted">No open reports.</p>}
      {data?.reports?.map((r: any) => (
        <div key={r.id} className="admin-row">
          <div>#{r.id} · post {r.postId} · user {r.reportedUserId} · w{r.weight}</div>
          <em>{r.reason}</em>
          <div>
            <button className="btn btn-sm" onClick={() => api(`/api/admin/reports/${r.id}/dismiss`, { method: "POST", body: "{}" }).then(load)}>Dismiss</button>
            <button className="btn btn-sm btn-danger" onClick={() => api(`/api/admin/reports/${r.id}/delete-post`, { method: "POST", body: "{}" }).then(load)}>Delete post</button>
            <button className="btn btn-sm btn-danger" onClick={() => api(`/api/admin/reports/${r.id}/ban-user`, { method: "POST", body: "{}" }).then(load)}>Ban user</button>
          </div>
        </div>
      ))}
    </div>
  );
}

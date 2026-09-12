import { api } from "../../api";
import { useAdmin } from "./useAdmin";

export function AdminVerifications() {
  const { data, load } = useAdmin("/api/admin/verifications");
  return (
    <div>
      <h1>Verifications</h1>
      {data?.requests?.map((r: any) => (
        <div key={r.id}>
          user {r.userId} {r.badge}
          <button onClick={() => api(`/api/admin/verifications/${r.id}/approve`, { method: "POST", body: "{}" }).then(load)}>Approve</button>
          <button onClick={() => api(`/api/admin/verifications/${r.id}/reject`, { method: "POST", body: "{}" }).then(load)}>Reject</button>
        </div>
      ))}
    </div>
  );
}

import { api } from "../../api";
import { useAdmin } from "./useAdmin";

export function AdminEntity() {
  const { data, load } = useAdmin("/api/admin/entity-verifications");
  return (
    <div>
      <h1>Entity & face</h1>
      {data?.faces?.map((u: any) => (
        <div key={u.id}>
          @{u.username}
          <button onClick={() => api(`/api/admin/face/${u.id}/approve`, { method: "POST", body: "{}" }).then(load)}>Approve face</button>
        </div>
      ))}
      {data?.channels?.map((c: any) => (
        <div key={c.id}>
          channel app {c.id}
          <button onClick={() => api(`/api/admin/verifications/channel/${c.id}/approve`, { method: "POST", body: "{}" }).then(load)}>Approve</button>
        </div>
      ))}
    </div>
  );
}

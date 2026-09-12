import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAdmin } from "./useAdmin";

export function AdminUserDetail() {
  const { id } = useParams();
  const { data, load } = useAdmin(`/api/admin/users/${id}`);
  if (!data) return null;
  const u = data.user;
  return (
    <div>
      <h1>@{u.username}</h1>
      <p>{u.email}</p>
      <button className="btn" onClick={() => api(`/api/admin/users/${id}/ban`, { method: "POST", body: "{}" }).then(load)}>Ban/unban</button>
      <button className="btn" onClick={() => api(`/api/admin/users/${id}/badge`, { method: "POST", body: JSON.stringify({ badge: "blue" }) }).then(load)}>Blue badge</button>
      <form onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await api(`/api/admin/users/${id}/credit`, { method: "POST", body: JSON.stringify({ amount: Number(fd.get("amount")) }) });
        load();
      }}>
        <input name="amount" type="number" />
        <button className="btn">Credit points</button>
      </form>
    </div>
  );
}

type RowAction = { label: string; style?: string; call: (row: unknown) => Promise<unknown> | unknown };

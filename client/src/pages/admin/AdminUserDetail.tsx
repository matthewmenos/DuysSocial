import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAdmin } from "./useAdmin";
import { BusyButton } from "../../components/BusyButton";
import { useBusy } from "../../components/useBusy";
import { PageError, PageLoading } from "../../components/PageState";

export function AdminUserDetail() {
  const { id } = useParams();
  const { data, load, error } = useAdmin(`/api/admin/users/${id}`);
  const { busy, run } = useBusy();
  if (error) return <PageError message={error} onRetry={() => void load()} />;
  if (!data) return <PageLoading label="Loading user…" />;
  const u = data.user;
  return (
    <div>
      <h1>@{u.username}</h1>
      <p>{u.email}</p>
      <button className="btn" onClick={() => api(`/api/admin/users/${id}/ban`, { method: "POST", body: "{}" }).then(load)}>Ban/unban</button>
      <button className="btn" onClick={() => api(`/api/admin/users/${id}/badge`, { method: "POST", body: JSON.stringify({ badge: "blue" }) }).then(load)}>Blue badge</button>
      <form onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        void run(async () => {
          await api(`/api/admin/users/${id}/credit`, { method: "POST", body: JSON.stringify({ amount: Number(fd.get("amount")) }) });
          form.reset();
          load();
        });
      }}>
        <input name="amount" type="number" />
        <BusyButton className="btn" type="submit" busy={busy} busyLabel="Crediting…">Credit points</BusyButton>
      </form>
    </div>
  );
}

type RowAction = { label: string; style?: string; call: (row: unknown) => Promise<unknown> | unknown };

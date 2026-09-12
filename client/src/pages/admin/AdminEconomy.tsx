import { api } from "../../api";
import { useAdmin } from "./useAdmin";

export function AdminEconomy() {
  const { data, load } = useAdmin("/api/admin/economy");
  return (
    <div>
      <h1>Economy</h1>
      <form onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const body: Record<string, string> = {};
        fd.forEach((v, k) => { body[k] = String(v); });
        await api("/api/admin/economy", { method: "POST", body: JSON.stringify(body) });
        load();
      }}>
        {data && Object.entries(data.values || {}).map(([k, v]) => (
          <div className="field" key={k}><label>{k}</label><input name={k} defaultValue={String(v)} /></div>
        ))}
        <button className="btn btn-primary">Save</button>
      </form>
    </div>
  );
}

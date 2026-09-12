import { api } from "../../api";
import { useAdmin } from "./useAdmin";

export function AdminSubscriptions() {
  const { data, load } = useAdmin("/api/admin/subscriptions");
  return (
    <div>
      <h1>Tiers</h1>
      {data?.tiers?.map((t: any) => <div key={t.id}>{t.name} · {t.priceDuys}</div>)}
      <form onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await api("/api/admin/subscriptions", { method: "POST", body: JSON.stringify({ name: fd.get("name"), priceDuys: Number(fd.get("priceDuys")) }) });
        load();
      }}>
        <input name="name" /><input name="priceDuys" type="number" /><button className="btn">Add</button>
      </form>
    </div>
  );
}

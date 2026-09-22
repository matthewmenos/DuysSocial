import { api } from "../../api";
import { BusyButton } from "../../components/BusyButton";
import { useBusy } from "../../components/useBusy";
import { useAdmin } from "./useAdmin";

export function AdminSubscriptions() {
  const { data, load } = useAdmin("/api/admin/subscriptions");
  const { busy, run } = useBusy();
  return (
    <div>
      <h1>Tiers</h1>
      {data?.tiers?.map((t: any) => <div key={t.id}>{t.name} · {t.priceDuys}</div>)}
      <form onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        void run(async () => {
          await api("/api/admin/subscriptions", { method: "POST", body: JSON.stringify({ name: fd.get("name"), priceDuys: Number(fd.get("priceDuys")) }) });
          form.reset();
          load();
        });
      }}>
        <input name="name" /><input name="priceDuys" type="number" />
        <BusyButton className="btn" type="submit" busy={busy} busyLabel="Adding…">Add</BusyButton>
      </form>
    </div>
  );
}

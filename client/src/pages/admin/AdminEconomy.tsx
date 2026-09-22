import { api } from "../../api";
import { BusyButton } from "../../components/BusyButton";
import { useBusy } from "../../components/useBusy";
import { useAdmin } from "./useAdmin";

export function AdminEconomy() {
  const { data, load } = useAdmin("/api/admin/economy");
  const { busy, run } = useBusy();
  return (
    <div>
      <h1>Economy</h1>
      <form onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const body: Record<string, string> = {};
        fd.forEach((v, k) => { body[k] = String(v); });
        void run(async () => {
          await api("/api/admin/economy", { method: "POST", body: JSON.stringify(body) });
          load();
        });
      }}>
        {data && Object.entries(data.values || {}).map(([k, v]) => (
          <div className="field" key={k}><label>{k}</label><input name={k} defaultValue={String(v)} /></div>
        ))}
        <BusyButton className="btn btn-primary" type="submit" busy={busy} busyLabel="Saving…">Save</BusyButton>
      </form>
    </div>
  );
}

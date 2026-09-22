import { api } from "../../api";
import { BusyButton } from "../../components/BusyButton";
import { useBusy } from "../../components/useBusy";
import { useAdmin } from "./useAdmin";

export function AdminFeatures() {
  const { data, load } = useAdmin("/api/admin/features");
  const { busy, run } = useBusy();
  return (
    <div>
      <h1>Features</h1>
      <form onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await api("/api/admin/features", { method: "POST", body: JSON.stringify({
            swap_buy_enabled: (e.currentTarget.elements.namedItem("swap_buy_enabled") as HTMLInputElement).checked,
            swap_sell_enabled: (e.currentTarget.elements.namedItem("swap_sell_enabled") as HTMLInputElement).checked,
          }) });
          load();
        });
      }}>
        <label><input type="checkbox" name="swap_buy_enabled" defaultChecked={data?.swap_buy_enabled} /> Buy swap</label>
        <label><input type="checkbox" name="swap_sell_enabled" defaultChecked={data?.swap_sell_enabled} /> Sell swap</label>
        <BusyButton className="btn" type="submit" busy={busy} busyLabel="Saving…">Save</BusyButton>
      </form>
    </div>
  );
}

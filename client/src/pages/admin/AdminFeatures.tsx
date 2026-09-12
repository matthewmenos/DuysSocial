import { api } from "../../api";
import { useAdmin } from "./useAdmin";

export function AdminFeatures() {
  const { data, load } = useAdmin("/api/admin/features");
  return (
    <div>
      <h1>Features</h1>
      <form onSubmit={async (e) => {
        e.preventDefault();
        await api("/api/admin/features", { method: "POST", body: JSON.stringify({
          swap_buy_enabled: (e.currentTarget.elements.namedItem("swap_buy_enabled") as HTMLInputElement).checked,
          swap_sell_enabled: (e.currentTarget.elements.namedItem("swap_sell_enabled") as HTMLInputElement).checked,
        }) });
        load();
      }}>
        <label><input type="checkbox" name="swap_buy_enabled" defaultChecked={data?.swap_buy_enabled} /> Buy swap</label>
        <label><input type="checkbox" name="swap_sell_enabled" defaultChecked={data?.swap_sell_enabled} /> Sell swap</label>
        <button className="btn">Save</button>
      </form>
    </div>
  );
}

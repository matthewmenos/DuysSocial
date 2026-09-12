import { api } from "../../api";
import { useAdmin } from "./useAdmin";

export function AdminSettings() {
  const { data, load } = useAdmin("/api/admin/settings");
  return (
    <div>
      <h1>Settings</h1>
      <form onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await api("/api/admin/settings", { method: "POST", body: JSON.stringify({ announcement_enabled: fd.get("announcement_enabled") === "on", announcement_text: fd.get("announcement_text") }) });
        load();
      }}>
        <label><input type="checkbox" name="announcement_enabled" defaultChecked={Boolean(data?.announcement_enabled)} /> Announcement</label>
        <input name="announcement_text" defaultValue={String(data?.announcement_text || "")} />
        <button className="btn btn-primary">Save</button>
      </form>
    </div>
  );
}

import { api } from "../../api";
import { BusyButton } from "../../components/BusyButton";
import { useBusy } from "../../components/useBusy";
import { useAdmin } from "./useAdmin";

export function AdminSettings() {
  const { data, load } = useAdmin("/api/admin/settings");
  const { busy, run } = useBusy();
  return (
    <div>
      <h1>Settings</h1>
      <form onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        void run(async () => {
          await api("/api/admin/settings", { method: "POST", body: JSON.stringify({ announcement_enabled: fd.get("announcement_enabled") === "on", announcement_text: fd.get("announcement_text") }) });
          load();
        });
      }}>
        <label><input type="checkbox" name="announcement_enabled" defaultChecked={Boolean(data?.announcement_enabled)} /> Announcement</label>
        <input name="announcement_text" defaultValue={String(data?.announcement_text || "")} />
        <BusyButton className="btn btn-primary" type="submit" busy={busy} busyLabel="Saving…">Save</BusyButton>
      </form>
    </div>
  );
}

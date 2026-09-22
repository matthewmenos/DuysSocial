import { api } from "../../api";
import { BusyButton } from "../../components/BusyButton";
import { useBusy } from "../../components/useBusy";

export function AdminBroadcast() {
  const { busy, run } = useBusy();
  return (
    <div>
      <h1>Broadcast</h1>
      <form onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        void run(async () => {
          await api("/api/admin/broadcast", { method: "POST", body: JSON.stringify({ title: fd.get("title"), body: fd.get("body") }) });
          alert("Sent");
        });
      }}>
        <input name="title" placeholder="Title" />
        <textarea name="body" />
        <BusyButton className="btn btn-primary" type="submit" busy={busy} busyLabel="Sending…">Send to all</BusyButton>
      </form>
    </div>
  );
}

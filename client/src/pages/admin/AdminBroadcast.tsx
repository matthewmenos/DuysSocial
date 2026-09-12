import { api } from "../../api";

export function AdminBroadcast() {
  return (
    <div>
      <h1>Broadcast</h1>
      <form onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await api("/api/admin/broadcast", { method: "POST", body: JSON.stringify({ title: fd.get("title"), body: fd.get("body") }) });
        alert("Sent");
      }}>
        <input name="title" placeholder="Title" />
        <textarea name="body" />
        <button className="btn btn-primary">Send to all</button>
      </form>
    </div>
  );
}

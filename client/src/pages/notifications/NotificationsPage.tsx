import { useEffect, useState } from "react";
import { api } from "../../api";

export function NotificationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api("/api/notifications").then((d) => setRows(d.notifications)); }, []);
  return (
    <div>
      <h2>Notifications</h2>
      {rows.map((n) => <div key={n.id}>{n.text}</div>)}
    </div>
  );
}

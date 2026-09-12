import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";

export function ChannelsPage() {
  const [data, setData] = useState<{ mine: any[]; discover: any[] } | null>(null);
  useEffect(() => { api("/api/channels").then(setData); }, []);
  return (
    <div>
      <h2>Channels</h2>
      <form onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await api("/api/channels/create", { method: "POST", body: fd });
        api("/api/channels").then(setData);
      }}>
        <input name="name" placeholder="Name" required />
        <input name="handle" placeholder="handle" required />
        <button className="btn btn-primary">Create</button>
      </form>
      <h3>Yours</h3>
      {data?.mine.map((c) => <Link key={c.id} to={`/channels/c/${c.handle}`}>{c.name}</Link>)}
      <h3>Discover</h3>
      {data?.discover.map((c) => <Link key={c.id} to={`/channels/c/${c.handle}`}>{c.name} · {c.subscriberCount}</Link>)}
    </div>
  );
}

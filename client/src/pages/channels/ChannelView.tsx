import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { PostCard, type Post } from "../../components/PostCard";
import { Composer } from "../../components/Composer";

export function ChannelView() {
  const { handle } = useParams();
  const [data, setData] = useState<any>(null);
  const [composer, setComposer] = useState(false);
  const load = () => api(`/api/channels/c/${handle}`).then(setData);
  useEffect(() => { load(); }, [handle]);
  if (!data) return null;
  if (data.gated) return <div>Private channel. You need an invite.</div>;
  return (
    <div>
      <h2>{data.channel.name}</h2>
      <p>{data.channel.description}</p>
      <button className="btn" onClick={async () => { await api(`/api/channels/c/${handle}/subscribe`, { method: "POST", body: "{}" }); load(); }}>
        {data.role ? "Leave" : "Join"}
      </button>
      {["owner", "admin"].includes(data.role) && <button className="btn btn-primary" onClick={() => setComposer(true)}>Broadcast</button>}
      {data.posts.map((p: Post) => <PostCard key={p.id} post={p} onChange={load} />)}
      {composer && <Composer channelId={data.channel.id} onClose={() => setComposer(false)} onPosted={() => { setComposer(false); load(); }} limit={2000} />}
    </div>
  );
}

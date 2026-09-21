import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Icon } from "../../components/Icon";
import { PageError, PageLoading } from "../../components/PageState";
import { socket } from "../../socket";

export function LiveRoomPage() {
  const { id } = useParams();
  const { boot } = useAuth();
  const nav = useNavigate();
  const [room, setRoom] = useState<any>(null);
  const [loadErr, setLoadErr] = useState("");
  const [chat, setChat] = useState("");
  const [msgs, setMsgs] = useState<any[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const host = room?.room?.hostId === boot?.user?.id;

  const load = () => api(`/api/live/${id}`)
    .then((d) => { setRoom(d); setMsgs(d.messages || []); setLoadErr(""); })
    .catch((ex) => setLoadErr((ex as Error).message || "This live room is unavailable."));
  useEffect(() => { void load(); }, [id]);

  useEffect(() => {
    socket.emit("join_live", Number(id));
    const onChat = (m: any) => setMsgs((x) => [...x, m]);
    const onEnd = () => nav("/live");
    socket.on("chat", onChat);
    socket.on("ended", onEnd);
    socket.on("frame", () => {
      const img = document.getElementById("lr-frame") as HTMLImageElement | null;
      if (img) img.src = `/api/live/${id}/frame.jpg?t=${Date.now()}`;
    });
    return () => { socket.off("chat", onChat); socket.off("ended", onEnd); socket.off("frame"); };
  }, [id]);

  useEffect(() => {
    if (!host || !videoRef.current) return;
    let timer: number;
    let stream: MediaStream;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }).then((s) => {
      stream = s;
      if (videoRef.current) videoRef.current.srcObject = s;
      const canvas = document.createElement("canvas");
      timer = window.setInterval(() => {
        const v = videoRef.current;
        if (!v || v.videoWidth === 0) return;
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        canvas.getContext("2d")?.drawImage(v, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const fd = new FormData();
          fd.append("frame", blob, "frame.jpg");
          api(`/api/live/${id}/frame`, { method: "POST", body: fd }).catch(() => {});
        }, "image/jpeg", 0.6);
      }, 400);
    }).catch(() => {});
    return () => { clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [host, id]);

  if (loadErr) return <PageError message={loadErr} onRetry={() => void load()} />;
  if (!room) return <PageLoading label="Joining live room…" />;
  const r = room.room;
  return (
    <div className="lr-room" id="lr-room">
      <div className="lr-stage">
        {host ? <video id="lr-self" ref={videoRef} autoPlay muted playsInline /> : (
          <>
            <img id="lr-frame" alt="" />
            <div className="lr-waiting" id="lr-waiting"><Icon name="broadcast" size={32} /> Connecting…</div>
          </>
        )}
      </div>
      <div className="lr-overlay">
        <header className="lr-top">
          <span className="lr-live-badge"><span className="live-dot" />LIVE</span>
          <button className="lr-close-btn" onClick={() => nav("/live")}><Icon name="close" size={22} /></button>
        </header>
        <div className="lr-chat">
          {msgs.map((m) => <div key={m.id || m.createdAt}>{m.username ? `@${m.username} ` : ""}{m.body}</div>)}
        </div>
        <footer className="lr-bottom">
          <form className="lr-compose" onSubmit={async (e) => {
            e.preventDefault();
            await api(`/api/live/${id}/chat`, { method: "POST", body: JSON.stringify({ body: chat }) });
            setChat("");
          }}>
            <input className="lr-input" value={chat} onChange={(e) => setChat(e.target.value)} placeholder="Say something…" maxLength={300} />
            <button className="lr-send-btn" type="submit"><Icon name="send" size={20} /></button>
          </form>
          {!host && <button className="lr-btn lr-btn-tip" onClick={async () => {
            const amount = Number(window.prompt("Tip DUYS", "1") || "0");
            if (amount) await api(`/api/live/${id}/tip`, { method: "POST", body: JSON.stringify({ amount }) });
          }}>💎</button>}
          <button className="lr-btn lr-btn-heart" onClick={() => api(`/api/live/${id}/react`, { method: "POST", body: JSON.stringify({ emoji: "❤️" }) })}>❤️</button>
          {host
            ? <button className="lr-btn lr-btn-end" onClick={async () => { await api(`/api/live/${id}/end`, { method: "POST", body: "{}" }); nav("/live"); }}>■</button>
            : <button className="lr-btn lr-btn-leave" onClick={() => nav("/live")}><Icon name="close" size={20} /></button>}
        </footer>
      </div>
    </div>
  );
}

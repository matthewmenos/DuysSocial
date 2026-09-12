import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Avatar, Icon } from "../../components/Icon";
import { socket } from "../../socket";

export function MessagesPage() {
  const { convId } = useParams();
  const { boot } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("chats");
  const [list, setList] = useState<any[]>([]);
  const [thread, setThread] = useState<any>(null);
  const [body, setBody] = useState("");
  const [q, setQ] = useState("");
  const [typer, setTyper] = useState<string>("");
  const bottom = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { api("/api/messages").then((d) => setList(d.conversations || [])); }, []);
  useEffect(() => {
    if (boot?.user?.id) socket.emit("presence", boot.user.id);
  }, [boot?.user?.id]);
  useEffect(() => {
    if (!convId) { setThread(null); return; }
    api(`/api/messages/c/${convId}`).then(setThread);
    socket.emit("join_conv", Number(convId));
    const onMsg = (m: any) => {
      if (m.conversationId === Number(convId)) setThread((t: any) => t ? { ...t, messages: [...(t.messages || []), m] } : t);
    };
    const onTyping = (p: any) => { if (Number(p.convId) === Number(convId) && p.userId !== boot?.user?.id) setTyper(p.username || "Someone"); };
    const onStopTyping = (p: any) => { if (Number(p.convId) === Number(convId)) setTyper(""); };
    socket.on("message", onMsg);
    socket.on("typing", onTyping);
    socket.on("stop_typing", onStopTyping);
    return () => {
      socket.emit("leave_conv", Number(convId));
      socket.off("message", onMsg);
      socket.off("typing", onTyping);
      socket.off("stop_typing", onStopTyping);
    };
  }, [convId]);
  useEffect(() => { bottom.current?.scrollIntoView(); }, [thread?.messages?.length]);

  const filtered = list.filter((c) => {
    if (tab === "groups") return c.isGroup;
    if (tab === "channels") return false;
    return !c.isGroup;
  }).filter((c) => {
    const name = (c.title || c.other?.displayName || "").toLowerCase();
    return !q || name.includes(q.toLowerCase()) || (c.lastMessage?.body || "").toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div className={`chat-layout ${convId ? "has-active" : ""}`} id="chat-layout">
      <div className="chat-list">
        <div className="page-head glass-bar chat-list-head">
          <div className="msg-tabs">
            {["chats", "groups", "channels"].map((t) => (
              <button key={t} className={`msg-tab ${tab === t ? "active" : ""}`} onClick={() => { setTab(t); if (t === "channels") nav("/channels"); }}>{t[0].toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
        </div>
        <div className="chat-search">
          <span><Icon name="search" size={16} /></span>
          <input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chat-rows">
          {filtered.map((c) => (
            <button key={c.id} className={`chat-row ${Number(convId) === c.id ? "active" : ""}`} onClick={() => nav(`/messages/${c.id}`)}>
              <Avatar url={c.isGroup ? c.avatarUrl : c.other?.avatarUrl} size={48} />
              <span className="chat-row-body">
                <strong>{c.isGroup ? (c.title || "Group") : (c.other?.displayName || "Chat")}</strong>
                <small className="muted">{c.lastMessage?.body || "No messages yet"}</small>
              </span>
              {c.unread > 0 && <span className="chat-unread">{c.unread}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="chat-thread">
        {!thread && <div className="chat-empty muted">Select a conversation</div>}
        {thread && (
          <>
            <div className="chat-thread-head glass-bar">
              <button className="icon-btn chat-back" onClick={() => nav("/messages")}><Icon name="arrow-left" size={20} /></button>
              <Avatar url={thread.conversation?.isGroup ? thread.conversation.avatarUrl : thread.members?.find((m: any) => m.id !== boot?.user?.id)?.avatarUrl} size={36} />
              <div>
                <strong>{thread.conversation?.isGroup ? thread.conversation.title : thread.members?.find((m: any) => m.id !== boot?.user?.id)?.displayName}</strong>
              </div>
              <button className="icon-btn" title="Call" onClick={() => api("/api/calls/start", { method: "POST", body: JSON.stringify({ convId: Number(convId), kind: "audio" }) })}><Icon name="phone" size={20} /></button>
              <button className="icon-btn" title="Video" onClick={() => api("/api/calls/start", { method: "POST", body: JSON.stringify({ convId: Number(convId), kind: "video" }) })}><Icon name="video" size={20} /></button>
            </div>
            <div className="chat-msgs">
              {typer && (
                <div className="msg msg-typing" title={`${typer} is typing…`}>
                  <span className="msg-typing-dot" />
                  <span className="msg-typing-dot" />
                  <span className="msg-typing-dot" />
                </div>
              )}
              {thread.messages?.map((m: any) => {
                const mine = m.senderId === boot?.user?.id;
                return (
                  <div key={m.id} className={`msg ${mine ? "mine" : "theirs"} ${m.deleted ? "is-deleted" : ""}`}>
                    {thread.conversation?.isGroup && !mine && <span className="msg-sender">{m.displayName}</span>}
                    {m.mediaUrl && m.mediaKind === "video" && <video className="msg-media" src={m.mediaUrl} controls />}
                    {m.mediaUrl && m.mediaKind !== "video" && m.mediaKind !== "audio" && <img src={m.mediaUrl} className="msg-media" alt="" />}
                    {m.body && <p className="msg-text">{m.body}</p>}
                    <div className="msg-meta"><time>{String(m.createdAt).slice(11, 16)}</time></div>
                  </div>
                );
              })}
              <div ref={bottom} />
            </div>
            <form className="chat-compose" onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData();
              fd.append("body", body);
              await api(`/api/messages/c/${convId}/send`, { method: "POST", body: fd });
              setBody("");
              api(`/api/messages/c/${convId}`).then(setThread);
            }}>
              <input value={body} onChange={(e) => {
                const v = e.target.value;
                setBody(v);
                if (!convId || !boot?.user?.id) return;
                const myId = boot.user.id, myName = boot.user.username;
                socket.emit("typing", { convId: Number(convId), userId: myId, username: myName });
                if (typingTimer.current) clearTimeout(typingTimer.current);
                typingTimer.current = setTimeout(() => {
                  socket.emit("stop_typing", { convId: Number(convId), userId: myId });
                }, 1500);
              }} placeholder="Message" />
              <label className="icon-btn">
                <Icon name="image" size={20} />
                <input type="file" hidden onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const fd = new FormData(); fd.append("media", f);
                  await api(`/api/messages/c/${convId}/send`, { method: "POST", body: fd });
                  api(`/api/messages/c/${convId}`).then(setThread);
                }} />
              </label>
              <button className="icon-btn" type="submit"><Icon name="send" /></button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

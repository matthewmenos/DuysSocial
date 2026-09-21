import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Avatar, Icon } from "../../components/Icon";
import { SkeletonList } from "../../components/PageState";
import { socket } from "../../socket";

type Other = { id: number; username: string; displayName: string; avatarUrl: string };
type Conv = {
  id: number;
  isGroup: boolean;
  title: string;
  avatarUrl: string;
  lastMessage: Msg | null;
  unread: number;
  muted: boolean;
  other: Other | null;
};
type Msg = {
  id: number;
  conversationId: number;
  senderId: number;
  body: string;
  mediaUrl: string;
  mediaKind: string;
  replyTo: number | null;
  viewOnce: boolean;
  forwarded: boolean;
  pinned: boolean;
  edited: boolean;
  deleted: boolean;
  createdAt: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  sender?: Other;
};
type Channel = { id: number; name: string; handle: string; avatarUrl: string; subscriberCount: number; role?: string; isMuted?: boolean };

const REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];
const EMOJIS = ["😀", "😂", "😍", "👍", "🙏", "🔥", "❤️", "🎉", "😭", "😮", "😅", "💯", "👀", "🤝", "💰", "🚀"];

/**
 * Mirrors DUYS/duys/templates/messaging/index.html: same chat-layout / chat-row /
 * msg-bubble / wa-compose class structure so the ported messaging.css applies.
 */
export function MessagesPage() {
  const { convId } = useParams();
  const { boot } = useAuth();
  const nav = useNavigate();
  const activeId = convId ? Number(convId) : null;

  const [tab, setTab] = useState("chats");
  const [q, setQ] = useState("");
  const [convs, setConvs] = useState<Conv[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [thread, setThread] = useState<{ conversation: Conv; messages: Msg[]; members: Other[]; role: string } | null>(null);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [typer, setTyper] = useState("");
  const [online, setOnline] = useState<Set<number>>(new Set());
  const [reactions, setReactions] = useState<Record<number, string>>({});
  const [menuFor, setMenuFor] = useState<Msg | null>(null);
  const [pickerFor, setPickerFor] = useState<Msg | null>(null);
  const [forwardFor, setForwardFor] = useState<Msg | null>(null);
  const [groupDrawer, setGroupDrawer] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [threadMenu, setThreadMenu] = useState(false);
  const [err, setErr] = useState("");

  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function loadList() {
    try {
      const d = await api("/api/messages");
      setConvs(d.conversations || []);
      const ch = await api("/api/channels");
      setChannels(ch.mine || []);
    } catch { /* not signed in */ }
    finally { setListLoaded(true); }
  }

  async function loadThread(id: number) {
    try {
      const d = await api(`/api/messages/c/${id}`);
      setThread(d);
    } catch {
      setThread(null);
      nav("/messages");
    }
  }

  useEffect(() => { void loadList(); }, []);
  useEffect(() => { if (activeId) void loadThread(activeId); else setThread(null); }, [activeId]);

  // Realtime: messages, edits, deletions, typing and presence.
  useEffect(() => {
    if (boot?.user?.id) socket.emit("presence", boot.user.id);
    const onMsg = (m: Msg) => {
      if (m.conversationId !== activeId) { void loadList(); return; }
      setThread((t) => (t ? { ...t, messages: [...t.messages, m] } : t));
      void loadList();
    };
    const onEdit = (m: Msg) => setThread((t) => (t ? { ...t, messages: t.messages.map((x) => (x.id === m.id ? m : x)) } : t));
    const onDelete = (p: { id: number }) =>
      setThread((t) => (t ? { ...t, messages: t.messages.map((x) => (x.id === p.id ? { ...x, deleted: true, body: "" } : x)) } : t));
    const onTyping = (p: { convId: number; userId: number; username: string }) => {
      if (Number(p.convId) === activeId && p.userId !== boot?.user?.id) setTyper(p.username || "Someone");
    };
    const onStopTyping = (p: { convId: number }) => { if (Number(p.convId) === activeId) setTyper(""); };
    const onPresence = (p: { userId: number; online: boolean }) =>
      setOnline((prev) => {
        const next = new Set(prev);
        if (p.online) next.add(p.userId); else next.delete(p.userId);
        return next;
      });

    socket.on("message", onMsg);
    socket.on("message_edit", onEdit);
    socket.on("message_delete", onDelete);
    socket.on("typing", onTyping);
    socket.on("stop_typing", onStopTyping);
    socket.on("presence", onPresence);
    return () => {
      socket.off("message", onMsg);
      socket.off("message_edit", onEdit);
      socket.off("message_delete", onDelete);
      socket.off("typing", onTyping);
      socket.off("stop_typing", onStopTyping);
      socket.off("presence", onPresence);
    };
  }, [activeId, boot?.user?.id]);

  useEffect(() => { if (activeId) socket.emit("join_conv", activeId); return () => { if (activeId) socket.emit("leave_conv", activeId); }; }, [activeId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [thread?.messages.length, typer]);

  const byId = useMemo(() => {
    const map = new Map<number, Msg>();
    for (const m of thread?.messages || []) map.set(m.id, m);
    return map;
  }, [thread?.messages]);

  const me = boot?.user;
  const activeConv = thread?.conversation;
  const isGroup = Boolean(activeConv?.isGroup);
  const other = activeConv?.other || null;
  const pinned = (thread?.messages || []).filter((m) => m.pinned && !m.deleted).at(-1) || null;

  const filtered = convs
    .filter((c) => (tab === "groups" ? c.isGroup : !c.isGroup))
    .filter((c) => {
      if (!q) return true;
      const hay = `${c.title || c.other?.displayName || ""} ${c.lastMessage?.body || ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  const filteredChannels = channels.filter((c) => !q || `${c.name} ${c.handle}`.toLowerCase().includes(q.toLowerCase()));

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !activeId) return;
    setBody("");
    const reply = replyTo;
    setReplyTo(null);
    try {
      await api(`/api/messages/c/${activeId}/send`, {
        method: "POST",
        body: JSON.stringify({ body: text, replyTo: reply?.id }),
      });
      await loadThread(activeId);
      await loadList();
    } catch (ex) {
      setErr((ex as Error).message);
    }
  }

  async function sendMedia(file: File) {
    if (!activeId) return;
    const fd = new FormData();
    fd.append("media", file);
    if (body.trim()) fd.append("body", body.trim());
    if (replyTo) fd.append("replyTo", String(replyTo.id));
    setBody("");
    setReplyTo(null);
    try {
      await api(`/api/messages/c/${activeId}/send`, { method: "POST", body: fd });
      await loadThread(activeId);
      await loadList();
    } catch (ex) {
      setErr((ex as Error).message);
    }
  }

  async function react(m: Msg, emoji: string) {
    setPickerFor(null);
    setMenuFor(null);
    setReactions((r) => ({ ...r, [m.id]: emoji }));
    await api(`/api/messages/m/${m.id}/react`, { method: "POST", body: JSON.stringify({ emoji }) }).catch(() => {});
  }

  async function editMessage(m: Msg) {
    const next = window.prompt("Edit message", m.body);
    setMenuFor(null);
    if (!next || next === m.body) return;
    await api(`/api/messages/m/${m.id}/edit`, { method: "POST", body: JSON.stringify({ body: next }) }).catch(() => {});
    if (activeId) await loadThread(activeId);
  }

  async function deleteMessage(m: Msg) {
    setMenuFor(null);
    await api(`/api/messages/m/${m.id}/delete`, { method: "POST", body: "{}" }).catch(() => {});
    if (activeId) await loadThread(activeId);
  }

  async function pinMessage(m: Msg) {
    setMenuFor(null);
    await api(`/api/messages/m/${m.id}/pin`, { method: "POST", body: "{}" }).catch(() => {});
    if (activeId) await loadThread(activeId);
  }

  async function forwardTo(convIdTarget: number) {
    if (!forwardFor) return;
    await api(`/api/messages/m/${forwardFor.id}/forward`, {
      method: "POST",
      body: JSON.stringify({ conversationId: convIdTarget }),
    }).catch(() => {});
    setForwardFor(null);
  }

  async function toggleMute() {
    if (!activeId) return;
    await api(`/api/messages/c/${activeId}/mute`, { method: "POST", body: "{}" }).catch(() => {});
    await loadList();
  }

  async function toggleBlock() {
    if (!activeId) return;
    const r = await api(`/api/messages/c/${activeId}/block`, { method: "POST", body: "{}" }).catch(() => null);
    if (r) setErr(r.blocked ? "User blocked." : "User unblocked.");
  }

  async function leaveChat() {
    if (!activeId) return;
    if (!window.confirm("Leave this conversation?")) return;
    await api(`/api/messages/c/${activeId}/leave`, { method: "POST", body: "{}" }).catch(() => {});
    await loadList();
    nav("/messages");
  }

  async function createGroup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") || "").trim();
    if (!title) return;
    try {
      const d = await api("/api/messages/group/create", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: String(fd.get("description") || ""),
          isPrivate: fd.get("isPrivate") === "on",
        }),
      });
      setGroupDrawer(false);
      await loadList();
      nav(`/messages/${d.conversation.id}`);
    } catch (ex) {
      setErr((ex as Error).message);
    }
  }

  function onComposeInput(value: string) {
    setBody(value);
    if (!activeId || !me?.id) return;
    socket.emit("typing", { convId: activeId, userId: me.id, username: me.username });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit("stop_typing", { convId: activeId, userId: me.id }), 1500);
  }

  function statusText() {
    if (isGroup) return `${thread?.members.length ?? 0} members`;
    if (other && online.has(other.id)) return "online";
    return "tap for info";
  }

  // Date-separator bookkeeping for the message list.
  let lastDate = "";

  return (
    <div className={`chat-layout ${activeConv ? "has-active" : ""}`}>
      {/* ── Chat list (left column) ── */}
      <div className="chat-list">
        <div className="page-head glass-bar chat-list-head">
          <div className="msg-tabs">
            {["chats", "groups", "channels"].map((t) => (
              <button key={t} className={`msg-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="chat-search">
          <span><Icon name="search" size={16} /></span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" autoComplete="off" />
        </div>

        {tab !== "channels" && (
          <div className="chat-tab-panel">
            {tab === "groups" && (
              <button className="msg-new-btn" onClick={() => setGroupDrawer(true)}>
                <Icon name="plus" size={16} /> New group
              </button>
            )}
            <div className="chat-rows">
              {!listLoaded && <SkeletonList count={6} />}
              {filtered.map((c) => {
                const peerId = c.other?.id;
                return (
                  <button
                    key={c.id}
                    className={`chat-row ${activeId === c.id ? "active" : ""}`}
                    onClick={() => nav(`/messages/${c.id}`)}
                  >
                    <span className={`chat-avatar ${peerId && online.has(peerId) ? "online" : ""}`}>
                      <Avatar url={c.isGroup ? c.avatarUrl : c.other?.avatarUrl} size={50} alt={c.title} />
                      {c.isGroup && <span className="chat-group-badge"><Icon name="user" size={11} /></span>}
                    </span>
                    <div className="chat-row-info">
                      <div className="chat-row-top">
                        <strong>{c.isGroup ? (c.title || "Group") : (c.other?.displayName || "Chat")}</strong>
                        {c.lastMessage && <time className="muted">{String(c.lastMessage.createdAt).slice(11, 16)}</time>}
                      </div>
                      <div className="chat-row-bottom">
                        <span className="chat-last">
                          {(c.lastMessage?.body || (c.isGroup ? "" : "Tap to chat")).slice(0, 36)}
                        </span>
                        {c.unread > 0 && <span className="chat-unread">{c.unread > 99 ? "99+" : c.unread}</span>}
                        {c.muted && <span className="chat-muted-ic" title="Muted"><Icon name="eye-off" size={13} /></span>}
                      </div>
                    </div>
                  </button>
                );
              })}
              {listLoaded && !filtered.length && (
                <p className="muted empty-chats">{tab === "groups" ? "No groups yet." : "No chats yet."}</p>
              )}
            </div>
          </div>
        )}

        {tab === "channels" && (
          <div className="chat-tab-panel">
            <Link className="msg-new-btn" to="/channels">
              <Icon name="broadcast" size={16} /> Browse channels
            </Link>
            <div className="chat-rows">
              {!listLoaded && <SkeletonList count={4} />}
              {filteredChannels.map((ch) => (
                <Link key={ch.id} className="chat-row" to={`/channels/c/${ch.handle}`}>
                  <span className="chat-avatar">
                    <Avatar url={ch.avatarUrl} size={50} alt={ch.name} />
                    <span className="chat-channel-badge"><Icon name="broadcast" size={11} /></span>
                  </span>
                  <div className="chat-row-info">
                    <div className="chat-row-top">
                      <strong>{ch.name}</strong>
                      {ch.role && ["owner", "admin"].includes(ch.role) && <span className="chat-role-chip">{ch.role}</span>}
                    </div>
                    <div className="chat-row-bottom">
                      <span className="chat-last">{ch.subscriberCount} subscribers</span>
                    </div>
                  </div>
                </Link>
              ))}
              {listLoaded && !filteredChannels.length && (
                <p className="muted empty-chats">
                  No channels yet. <Link className="link-mention" to="/channels">Browse →</Link>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {activeConv ? (
        <div className="chat-thread">
          <header className="chat-thread-head">
            <button className="icon-btn back-to-list" onClick={() => nav("/messages")} title="Back">
              <Icon name="arrow-left" size={20} />
            </button>
            <div className="chat-head-identity">
              <span className={`chat-avatar ${other && online.has(other.id) ? "online" : ""}`}>
                <Avatar url={isGroup ? activeConv.avatarUrl : other?.avatarUrl} size={40} alt={activeConv.title} />
              </span>
              <div className="chat-head-info">
                <strong>{isGroup ? (activeConv.title || "Group") : (other?.displayName || "Chat")}</strong>
                <span className="chat-status">{statusText()}</span>
              </div>
            </div>
            <div className="chat-head-actions">
              {!isGroup && (
                <button
                  className="chat-head-btn"
                  title="Video call"
                  onClick={() => void api("/api/calls/start", { method: "POST", body: JSON.stringify({ convId: activeId, kind: "video" }) })}
                >
                  <Icon name="video" size={20} />
                </button>
              )}
              {!isGroup && (
                <button
                  className="chat-head-btn"
                  title="Voice call"
                  onClick={() => void api("/api/calls/start", { method: "POST", body: JSON.stringify({ convId: activeId, kind: "audio" }) })}
                >
                  <Icon name="phone" size={20} />
                </button>
              )}
              <button className="chat-head-btn" title="More" onClick={() => setThreadMenu((v) => !v)}>
                <Icon name="more" size={20} />
              </button>
            </div>
          </header>

          {threadMenu && (
            <div className="msg-menu" style={{ position: "static", display: "block" }}>
              <button className="cmm-item" onClick={() => { setThreadMenu(false); void toggleMute(); }}>
                {activeConv.muted ? "Unmute notifications" : "Mute notifications"}
              </button>
              <button className="cmm-item" onClick={() => { setThreadMenu(false); void toggleBlock(); }}>Block / unblock</button>
              <button className="cmm-item" onClick={() => { setThreadMenu(false); void leaveChat(); }}>Leave conversation</button>
            </div>
          )}

          {pinned && (
            <button className="pinned-bar" onClick={() => setPinnedOpen((v) => !v)}>
              <Icon name="boost" size={15} />
              <div>
                <span className="muted small">Pinned message</span>
                <p>{pinnedOpen ? pinned.body : (pinned.body || "Media").slice(0, 70)}</p>
              </div>
            </button>
          )}

          <div className="chat-messages">
            <div className="msg-date-sep chat-encrypted-notice" style={{ marginBottom: 16 }}>
              <span>
                <Icon name="lock" size={12} /> Messages are end-to-end encrypted. Only people in this chat can read, listen to, or share them.
              </span>
            </div>
            {(thread?.messages || []).map((m) => {
              const mine = m.senderId === me?.id;
              const date = String(m.createdAt).slice(0, 10);
              const showDate = date !== lastDate;
              lastDate = date;
              const replied = m.replyTo ? byId.get(m.replyTo) : undefined;
              return (
                <Fragment key={m.id}>
                  {showDate && <div className="msg-date-sep"><span>{date}</span></div>}
                  <div className={`msg ${mine ? "mine" : "theirs"} ${m.deleted ? "is-deleted" : ""}`} id={`msg-${m.id}`}>
                    {isGroup && !mine && !m.deleted && <span className="msg-sender">{m.displayName}</span>}
                    {m.forwarded && <span className="msg-forwarded"><Icon name="repost" size={12} /> Forwarded</span>}
                    {replied && (
                      <a className="msg-reply-ref" href={`#msg-${replied.id}`}>
                        <strong>{replied.displayName || replied.sender?.displayName || "Message"}</strong>
                        <span>{(replied.body || replied.mediaKind || "media").slice(0, 60)}</span>
                      </a>
                    )}

                    {m.deleted ? (
                      <p className="msg-deleted-text"><Icon name="trash" size={14} /> This message was deleted</p>
                    ) : m.viewOnce ? (
                      <>
                        <div className="msg-vo msg-vo-available">
                          <Icon name="eye" size={18} /><span>View once {m.mediaKind || "media"}</span>
                        </div>
                        {m.body && <p className="msg-text">{m.body}</p>}
                      </>
                    ) : (
                      <>
                        {m.mediaUrl && m.mediaKind === "video" && (
                          <div className="msg-video-wrap">
                            <video src={m.mediaUrl} controls preload="metadata" playsInline />
                          </div>
                        )}
                        {m.mediaUrl && m.mediaKind === "audio" && (
                          <div className="msg-voice">
                            <audio className="msg-audio-native" src={m.mediaUrl} controls preload="none" />
                          </div>
                        )}
                        {m.mediaUrl && m.mediaKind === "file" && (
                          <a className="msg-file" href={m.mediaUrl} target="_blank" rel="noreferrer" download>
                            <span className="msg-file-ic"><Icon name="document" size={22} /></span>
                            <span className="msg-file-meta"><strong>Document</strong><small>Tap to open</small></span>
                          </a>
                        )}
                        {m.mediaUrl && (!m.mediaKind || m.mediaKind === "image") && (
                          <img className="msg-media" src={m.mediaUrl} alt="" />
                        )}
                        {m.body && <p className="msg-text">{m.body}</p>}
                      </>
                    )}

                    {reactions[m.id] && <span className="reaction">{reactions[m.id]}</span>}

                    <div className="msg-meta">
                      <time>{String(m.createdAt).slice(11, 16)}</time>
                      {m.edited && <span className="msg-edited">edited</span>}
                    </div>
                    {!m.deleted && (
                      <button className="msg-actions-btn" aria-label="Message actions" onClick={() => setMenuFor(m)}>
                        ⋮
                      </button>
                    )}
                  </div>
                </Fragment>
              );
            })}
            <div ref={bottom} />

          </div>

          {typer && (
            <div className="chat-typing-bubble">
              <div className="ctb-avatar" />
              <div className="ctb-body">
                <span className="ctb-dot" /><span className="ctb-dot" /><span className="ctb-dot" />
              </div>
            </div>
          )}

          <div className="wa-bottom">
            {replyTo && (
              <div className="wa-reply-banner">
                <div className="wa-reply-body">
                  <strong>{replyTo.displayName || "Message"}</strong>
                  <span>{(replyTo.body || replyTo.mediaKind || "").slice(0, 60)}</span>
                </div>
                <button className="wa-icon-btn" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                  <Icon name="close" size={18} />
                </button>
              </div>
            )}

            {emojiOpen && (
              <div className="wa-emoji-panel">
                <div className="wa-emoji-grid">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      className="wa-emoji-btn"
                      onClick={() => { onComposeInput(body + e); setEmojiOpen(false); }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form className="wa-compose" onSubmit={send}>
              <button type="button" className="wa-pill wa-emoji-btn" title="Emoji" onClick={() => setEmojiOpen((v) => !v)}>
                😊
              </button>
              <label className="wa-pill wa-attach-wrap" title="Attach a photo, video or voice note">
                <Icon name="image" size={20} />
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*,video/*,audio/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void sendMedia(f);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                />
              </label>
              <input
                className="wa-input"
                value={body}
                onChange={(e) => onComposeInput(e.target.value)}
                placeholder="Type a message"
                maxLength={4000}
              />
              <button className="wa-action-btn" type="submit" title="Send"><Icon name="send" size={20} /></button>
            </form>
          </div>

        </div>
      ) : (
        <div className="empty-state chat-empty">
          <div style={{ maxWidth: 320, textAlign: "center" }}>
            <Icon name="mail" size={56} />
            <h3 style={{ margin: "12px 0 6px" }}>DUYS Web</h3>
            <p className="muted">Send and receive messages to your followers. Start a new chat by visiting someone's profile.</p>
          </div>
        </div>
      )}

      {err && (
        <div className="flashes" style={{ position: "fixed", top: 12, left: 12, right: 12, zIndex: 80 }}>
          <div className="flash flash-error">
            <div className="flash-body">{err}</div>
            <button className="flash-close" onClick={() => setErr("")}><Icon name="close" size={16} /></button>
          </div>
        </div>
      )}

      {pickerFor && (
        <div
          className="reaction-picker"
          style={{ position: "fixed", left: 12, right: 12, bottom: 92, zIndex: 70, display: "flex" }}
        >
          {REACTIONS.map((e) => (
            <button key={e} className="rp-emoji" onClick={() => void react(pickerFor, e)}>{e}</button>
          ))}
        </div>
      )}

      {menuFor && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setMenuFor(null)} />
          <div className="modal-panel">
            <header className="modal-head">
              <button className="icon-btn" onClick={() => setMenuFor(null)} aria-label="Close"><Icon name="close" size={22} /></button>
              <span className="modal-title">Message</span>
            </header>
            <div className="msg-menu" style={{ position: "static", display: "block", background: "transparent", boxShadow: "none" }}>
              <button className="cmm-item" onClick={() => { setReplyTo(menuFor); setMenuFor(null); }}>Reply</button>
              <button className="cmm-item" onClick={() => setPickerFor(menuFor)}>React</button>
              <button
                className="cmm-item"
                onClick={() => { void navigator.clipboard.writeText(menuFor.body || "").catch(() => {}); setMenuFor(null); }}
              >
                Copy text
              </button>
              <button className="cmm-item" onClick={() => { setForwardFor(menuFor); setMenuFor(null); }}>Forward</button>
              <button className="cmm-item" onClick={() => void pinMessage(menuFor)}>{menuFor.pinned ? "Unpin" : "Pin"}</button>
              {menuFor.senderId === me?.id && (
                <button className="cmm-item" onClick={() => void editMessage(menuFor)}>Edit</button>
              )}
              {menuFor.senderId === me?.id && (
                <button className="cmm-item" onClick={() => void deleteMessage(menuFor)}>Delete</button>
              )}
            </div>
          </div>
        </div>
      )}

      {forwardFor && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setForwardFor(null)} />
          <div className="modal-panel">
            <header className="modal-head">
              <button className="icon-btn" onClick={() => setForwardFor(null)} aria-label="Close"><Icon name="close" size={22} /></button>
              <span className="modal-title">Forward to…</span>
            </header>
            <div className="forward-list">
              {convs.map((c) => (
                <button key={c.id} className="chat-row" onClick={() => void forwardTo(c.id)}>
                  <span className="chat-avatar">
                    <Avatar url={c.isGroup ? c.avatarUrl : c.other?.avatarUrl} size={44} alt={c.title} />
                  </span>
                  <div className="chat-row-info">
                    <div className="chat-row-top">
                      <strong>{c.isGroup ? (c.title || "Group") : (c.other?.displayName || "Chat")}</strong>
                    </div>
                  </div>
                </button>
              ))}
              {!convs.length && <p className="muted" style={{ padding: 16 }}>No conversations yet.</p>}
            </div>
          </div>
        </div>
      )}

      {groupDrawer && (
        <div className="msg-drawer">
          <div className="msg-drawer-backdrop" onClick={() => setGroupDrawer(false)} />
          <div className="msg-drawer-panel">
            <div className="msg-drawer-handle" />
            <h2 className="msg-drawer-title">New group</h2>
            <form onSubmit={createGroup}>
              <div className="msg-field">
                <label className="msg-label">Group name</label>
                <input className="msg-input" type="text" name="title" placeholder="My Group" required maxLength={80} />
              </div>
              <div className="msg-field">
                <label className="msg-label">Description <span className="muted small">optional</span></label>
                <textarea
                  className="msg-input msg-textarea"
                  name="description"
                  rows={2}
                  placeholder="What's this group about?"
                  maxLength={300}
                />
              </div>
              <div className="msg-field msg-toggle-row">
                <div>
                  <div className="msg-label">Private group</div>
                  <div className="muted small">Only invited members can join.</div>
                </div>
                <label className="msg-toggle">
                  <input type="checkbox" name="isPrivate" />
                  <span className="msg-toggle-track" />
                </label>
              </div>
              <button className="btn btn-primary btn-block" type="submit">Create group</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

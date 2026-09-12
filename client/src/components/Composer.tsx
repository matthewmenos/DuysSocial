import { useState } from "react";
import { api } from "../api";
import { Icon } from "./Icon";

export function Composer({
  onClose,
  onPosted,
  limit,
  channelId,
}: {
  onClose: () => void;
  onPosted: () => void;
  limit: number;
  channelId?: number;
}) {
  const [kind, setKind] = useState("text");
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [poll, setPoll] = useState(["", ""]);
  const [exclusive, setExclusive] = useState(false);
  const [price, setPrice] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("body", body);
      fd.append("title", title);
      if (channelId) fd.append("channelId", String(channelId));
      if (exclusive) {
        fd.append("isExclusive", "1");
        fd.append("unlockPrice", price);
      }
      poll.filter(Boolean).forEach((o) => fd.append("pollOptions", o));
      if (files) Array.from(files).forEach((f) => fd.append("media", f));
      await api("/api/posts", { method: "POST", body: fd });
      onPosted();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-panel">
        <div className="modal-head">
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
          <div className="modal-title">Create post</div>
        </div>
        <div className="composer-kinds">
          {["text", "image", "video", "poll", "article"].map((k) => (
            <button key={k} className={`btn btn-sm ${kind === k ? "btn-primary" : ""}`} onClick={() => setKind(k)}>{k}</button>
          ))}
        </div>
        {kind === "article" && <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />}
        <textarea className="composer-input" rows={5} maxLength={limit} placeholder="What's happening?" value={body} onChange={(e) => setBody(e.target.value)} />
        <small className="muted">{body.length}/{limit}</small>
        {(kind === "image" || kind === "video") && (
          <input type="file" multiple accept={kind === "video" ? "video/*" : "image/*"} onChange={(e) => setFiles(e.target.files)} />
        )}
        {kind === "poll" && poll.map((o, i) => (
          <input key={i} placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setPoll(poll.map((x, j) => (j === i ? e.target.value : x)))} />
        ))}
        {kind === "poll" && poll.length < 6 && <button className="btn btn-sm" onClick={() => setPoll([...poll, ""])}>Add option</button>}
        <label className="checkbox-label">
          <input type="checkbox" checked={exclusive} onChange={(e) => setExclusive(e.target.checked)} /> Exclusive (verified)
        </label>
        {exclusive && <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Unlock price $DUYS" />}
        {err && <p className="flash flash-error">{err}</p>}
        <button className="btn btn-primary btn-block" disabled={busy} onClick={submit}>{busy ? "Posting…" : "Post"}</button>
      </div>
    </div>
  );
}

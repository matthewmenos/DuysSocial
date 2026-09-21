import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Icon } from "../components/Icon";

type CallEvent = { type: string; callId?: string; kind?: string; data?: RTCSessionDescriptionInit | RTCIceCandidateInit; from?: number; to?: number };

/** WhatsApp-style incoming-call + active-call overlay (mirrors calls.css + messaging template). */
export function CallOverlay() {
  const { boot } = useAuth();
  const [incoming, setIncoming] = useState<CallEvent | null>(null);
  const [active, setActive] = useState<CallEvent | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [vol, setVol] = useState(75);

  useEffect(() => {
    let t: number;
    async function poll() {
      try {
        const data = await api("/api/calls/poll");
        for (const ev of data.events || []) {
          if (ev.type === "incoming") setIncoming(ev);
          if (ev.type === "ended") { setActive(null); pc.current?.close(); }
        }
      } catch {}
      t = window.setTimeout(poll, 2500);
    }
    poll();
    return () => clearTimeout(t);
  }, [active]);

  const callerUser = boot?.user;

  function renderAvatar(size: number) {
    if (callerUser?.avatarUrl) return <img src={callerUser.avatarUrl} width={size} height={size} alt={callerUser.displayName || "Contact"} />;
    const name = callerUser?.displayName || "Contact";
    const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 800, borderRadius: "50%", width: size, height: size, background: "#00a884", color: "#fff" }}>{initials}</div>;
  }

    // ── Incoming call ──
  if (incoming && !active) {
    return (
      <div className="incoming-call">
        <div className="ic-card">
          <div className="ic-avatar">{renderAvatar(88)}</div>
          <div className="ic-name">{callerUser?.displayName || "DUYS user"}</div>
          <div className="ic-sub">@{callerUser?.username || "user"} · Incoming {incoming.kind || "call"}</div>
          <span className={`ic-kind-badge`}>{incoming.kind === "video" ? "📹 Video" : "🔊 Voice"}</span>
          <div className="ic-actions">
            <div className="ic-btn-wrap">
              <button className="ic-btn ic-decline" onClick={async () => {
                await api(`/api/calls/${incoming.callId}/decline`, { method: "POST", body: "{}" });
                setIncoming(null);
              }}><Icon name="close" size={28} /></button>
              <span className="ic-btn-label">Decline</span>
            </div>
            <div className="ic-btn-wrap">
              <button className="ic-btn ic-accept" onClick={async () => {
                await api(`/api/calls/${incoming.callId}/accept`, { method: "POST", body: "{}" });
                setActive(incoming);
                setIncoming(null);
              }}><Icon name={incoming.kind === "video" ? "video" : "phone"} size={28} /></button>
              <span className="ic-btn-label">Accept</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Active call ──
  if (active) {
    const isVideo = active.kind === "video";
    return (
      <div className="call-overlay">
        <div className="call-bg" />
        {isVideo ? (
          <>
            <div className="call-video-layout">
              <div className="call-remote-video"><video autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }} /></div>
              <div className="call-self"><video autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button className="call-self-flip"><Icon name="refresh" size={16} /></button>
              </div>
              <div className="call-video-top">
                <span className="call-video-name">{callerUser?.displayName || "Contact"}</span>
                <span className="call-video-status">Connected</span>
              </div>
            </div>
          </>
        ) : (
          <div className="call-voice-layout">
            <div className="call-peer-av">{renderAvatar(108)}</div>
            <div className="call-peer-name">{callerUser?.displayName || "Contact"}</div>
            <div className="call-status">On a call…</div>
          </div>
        )}
        <div className="call-controls">
          <div className="call-ctrl-btn" onClick={() => setMuted(!muted)}>
            <div className="call-ctrl-icon" style={{ background: muted ? "#f4212e" : "rgba(255,255,255,0.12)" }}>
              <Icon name={muted ? "mic" : "mic-off"} size={26} />
            </div>
          </div>
          {isVideo && (
            <div className="call-ctrl-btn flip-cam" onClick={() => setCameraOn(!cameraOn)}>
              <div className="call-ctrl-icon"><Icon name="refresh" size={24} /></div>
            </div>
          )}
          <div className="call-ctrl-btn call-ctrl-end" onClick={async () => {
            await api(`/api/calls/${active.callId}/end`, { method: "POST", body: "{}" });
            setActive(null);
            pc.current?.close();
          }}>
            <div className="call-ctrl-icon"><Icon name="phone" size={26} /></div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

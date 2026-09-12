import { useEffect, useRef, useState } from "react";
import { api } from "../api";

type Event = { type: string; callId?: string; kind?: string; data?: RTCSessionDescriptionInit | RTCIceCandidateInit; from?: number; to?: number };

export function CallOverlay() {
  const [incoming, setIncoming] = useState<Event | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    let t: number;
    async function poll() {
      try {
        const data = await api("/api/calls/poll");
        for (const ev of data.events || []) {
          if (ev.type === "incoming") setIncoming(ev);
          if (ev.type === "ended") {
            setActive(null);
            pc.current?.close();
          }
        }
      } catch { /* ignore */ }
      t = window.setTimeout(poll, 2500);
    }
    poll();
    return () => clearTimeout(t);
  }, []);

  if (!incoming && !active) return null;
  return (
    <div className="modal">
      <div className="modal-backdrop" />
      <div className="modal-panel" style={{ maxWidth: 360, textAlign: "center" }}>
        {incoming && !active && (
          <>
            <h3>Incoming {incoming.kind || "call"}</h3>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={async () => {
                await api(`/api/calls/${incoming.callId}/accept`, { method: "POST", body: "{}" });
                setActive(incoming.callId!);
                setIncoming(null);
              }}>Accept</button>
              <button className="btn btn-danger" onClick={async () => {
                await api(`/api/calls/${incoming.callId}/decline`, { method: "POST", body: "{}" });
                setIncoming(null);
              }}>Decline</button>
            </div>
          </>
        )}
        {active && (
          <>
            <h3>On a call</h3>
            <button className="btn btn-danger" onClick={async () => {
              await api(`/api/calls/${active}/end`, { method: "POST", body: "{}" });
              setActive(null);
            }}>End</button>
          </>
        )}
      </div>
    </div>
  );
}

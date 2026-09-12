import { useEffect, useState } from "react";
import { api } from "../../api";

export function VerificationPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api("/api/verification").then(setData); }, []);
  return (
    <div>
      <h2>Verification</h2>
      <p>Current: {data?.badge || "none"} · face: {data?.face}</p>
      {["blue", "gold", "grey"].map((b) => (
        <button key={b} className="btn" onClick={() => api("/api/verification/apply", { method: "POST", body: JSON.stringify({ badge: b, paymentMethod: "points" }) })}>
          Apply {b} ({data?.fees?.[b]})
        </button>
      ))}
      <h3>Face check</h3>
      <form onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await api("/api/verification/face", { method: "POST", body: fd });
      }}>
        <label>ID photo<input type="file" name="idPhoto" /></label>
        <label>Selfie<input type="file" name="selfie" /></label>
        <button className="btn btn-primary">Submit</button>
      </form>
    </div>
  );
}

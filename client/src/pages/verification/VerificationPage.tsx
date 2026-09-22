import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api";
import { Badge, Icon } from "../../components/Icon";
import { BusyButton } from "../../components/BusyButton";
import { useBusy } from "../../components/useBusy";
import { PageLoading } from "../../components/PageState";

type Verif = {
  badge: string;
  expires: string;
  face: string;
  fees: Record<string, number>;
  pending: { id: number; badge: string; status: string } | null;
  points: number;
  tokens: number;
};
type Hist = { id: number; badge: string; amount: number; status: string; createdAt: string };

const BADGES = [
  {
    key: "blue",
    name: "Blue Verification",
    desc: "For creators and notable public figures.",
    benefits: ["Verified individual checkmark", "Priority in search results", "Exclusive creator tools", "Build audience trust"],
  },
  {
    key: "gold",
    name: "Gold Verification",
    desc: "For organizations, brands and businesses.",
    benefits: ["Organization-level checkmark", "Business & brand credibility", "Team member linking", "Priority support access"],
  },
  {
    key: "grey",
    name: "Grey Verification",
    desc: "For governments and institutions.",
    benefits: ["Government / institution mark", "Institutional credibility", "Official account status", "Highest trust tier"],
  },
];

/** Mirrors DUYS/duys/templates/verification/index.html (classes come from its inline <style>). */
export function VerificationPage() {
  const [data, setData] = useState<Verif | null>(null);
  const [history, setHistory] = useState<Hist[]>([]);
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [nationality, setNationality] = useState("");
  const [idType, setIdType] = useState("passport");
  const { busy, run: runIdentity } = useBusy();
  const { busy: applying, run: runApply } = useBusy();
  const [err, setErr] = useState("");

  const load = () => {
    api("/api/verification").then(setData).catch(() => {});
    api("/api/verification/history").then((d) => setHistory(d.requests || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const locked = data?.face !== "approved";
  const afford = (fee: number) => (data?.tokens ?? 0) >= fee;
  const pointsPrice = (fee: number) => Math.round(fee * 1000);

  function applyBadge(badge: string) {
    setErr("");
    if (locked) {
      setWizard(true);
      setStep(0);
      return;
    }
    if (!afford(data?.fees?.[badge] ?? 0)) {
      setErr("Insufficient $DUYS balance for that badge.");
      return;
    }
    void runApply(async () => {
      try {
        await api("/api/verification/apply", {
          method: "POST",
          body: JSON.stringify({ badge, paymentMethod: "tokens" }),
        });
        load();
      } catch (ex) {
        setErr((ex as Error).message);
      }
    });
  }

  function submitIdentity(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!idFile || !selfie) {
      setErr("Attach your ID photo and a clear selfie.");
      return;
    }
    setErr("");
    const fd = new FormData();
    fd.append("idPhoto", idFile);
    fd.append("selfie", selfie);
    fd.append("nationality", nationality);
    fd.append("idType", idType);
    void runIdentity(async () => {
      try {
        await api("/api/verification/face", { method: "POST", body: fd });
        setWizard(false);
        setStep(0);
        setIdFile(null);
        setSelfie(null);
        load();
      } catch (ex) {
        setErr((ex as Error).message);
      }
    });
  }

  if (!data) return <PageLoading label="Loading verification…" />;

  return (
    <>
      <div className="verif-wrap">
        {/* ── Hero ── */}
        <div className="verif-hero">
          <div className="verif-hero-icon"><Icon name="shield" size={34} /></div>
          <h1>Get Verified</h1>
          <p>
            Join the trusted community. A verified badge shows your audience
            <br /> that your identity has been confirmed by the DUYS team.
          </p>
        </div>

        {/* ── Active badge ── */}
        {data.badge && (
          <div className="verif-active-badge">
            <Badge kind={data.badge} />
            <div className="vab-info">
              <div className="vab-title">{data.badge.charAt(0).toUpperCase() + data.badge.slice(1)} Badge Active</div>
              <div className="vab-sub">{data.expires ? `Renews ${String(data.expires).slice(0, 10)}` : ""}</div>
            </div>
          </div>
        )}

        {/* ── Identity verification status ── */}
        {data.face === "approved" && (
          <div className="verif-status-banner vsb-approved">
            <div className="vsb-icon"><Icon name="verify" size={18} /></div>
            <div className="vsb-body">
              <div className="vsb-title">Identity Verified</div>
              <div className="vsb-sub">Your identity has been confirmed. Choose a badge below to apply.</div>
            </div>
          </div>
        )}
        {data.face === "pending" && (
          <div className="verif-status-banner vsb-pending">
            <div className="vsb-icon"><Icon name="info" size={18} /></div>
            <div className="vsb-body">
              <div className="vsb-title">Identity Check In Review</div>
              <div className="vsb-sub">Our team is reviewing your submission. Badge applications unlock once approved — usually within 24 hours.</div>
            </div>
          </div>
        )}
        {data.face === "rejected" && (
          <div className="verif-status-banner vsb-rejected">
            <div className="vsb-icon"><Icon name="close" size={18} /></div>
            <div className="vsb-body">
              <div className="vsb-title">Verification Rejected</div>
              <div className="vsb-sub">Your submission didn't pass — please redo the identity check below using a valid ID and a clear selfie.</div>
            </div>
          </div>
        )}

        {/* ── Balance strip ── */}
        <div className="verif-balance">
          <Icon name="coins" size={18} />
          <span className="verif-balance-rate">Balance</span>
          <span className="verif-balance-amt">{Number(data.tokens ?? 0).toFixed(4)} DUYS</span>
          <span className="verif-balance-rate">· {data.points ?? 0} points</span>
          <span className="verif-balance-rate">· {pointsPrice(data.fees?.blue ?? 5)} points for Blue</span>
        </div>

        {err && <div className="verif-notice verif-notice-err">{err}</div>}

        {/* ── Badge cards ── */}
        <div className="verif-badges">
          {BADGES.map((b) => {
            const fee = data.fees?.[b.key] ?? 0;
            const isLocked = locked;
            return (
              <div className={`vbadge-card vbadge-card-${b.key}`} key={b.key}>
                <div className="vbadge-card-glow" />
                <div className="vbadge-icon"><Badge kind={b.key} /></div>
                <div className="vbadge-name">{b.name}</div>
                <div className="vbadge-desc">{b.desc}</div>
                <div className="vbadge-fee">
                  ${fee.toFixed(2)}<span>/month</span> <span>≈ {fee} DUYS</span>
                </div>
                <ul className="vbadge-benefits">
                  {b.benefits.map((ben) => (
                    <li key={ben}><Icon name="verify" size={13} /> {ben}</li>
                  ))}
                </ul>
                <BusyButton
                  className="vbadge-select-btn"
                  busy={applying}
                  busyLabel="Applying…"
                  title={isLocked ? "Complete identity verification first" : `Apply for ${fee} DUYS`}
                  onClick={() => applyBadge(b.key)}
                >
                  {isLocked ? "🔒 Verify Identity First" : afford(fee) ? `Apply · ${fee} DUYS` : "Insufficient Balance"}
                </BusyButton>
              </div>
            );
          })}
        </div>

        {/* ── Application history ── */}
        {history.length > 0 && (
          <div className="verif-history">
            <h3>Your Applications</h3>
            {history.map((r) => (
              <div className="verif-hist-row" key={r.id}>
                <div><Badge kind={r.badge} /></div>
                <div className="verif-hist-badge">{r.badge.charAt(0).toUpperCase() + r.badge.slice(1)} badge</div>
                <div className="verif-hist-amt">{r.amount} DUYS</div>
                <span className={`status status-${r.status}`}>{r.status}</span>
                <time className="muted small">{String(r.createdAt).slice(0, 10)}</time>
              </div>
            ))}
          </div>
        )}
      </div>

      {wizard && (
        <div className="verif-wizard" role="dialog" aria-modal="true">
          <div className="verif-wizard-backdrop" onClick={() => setWizard(false)} />
          <div className="verif-wizard-panel">
            <div className="verif-wiz-head">
              <div className="verif-wiz-title">Identity Verification</div>
              <button className="verif-wiz-close" onClick={() => setWizard(false)}><Icon name="close" size={18} /></button>
            </div>
            <div className="verif-wiz-progress">
              {["Instructions", "Documents"].map((label, i) => (
                <span key={label} className={`verif-wiz-dot ${i <= step ? "active" : ""}`} title={label} />
              ))}
            </div>
            {err && <div className="verif-notice verif-notice-err">{err}</div>}

            <div className={`verif-wiz-step ${step === 0 ? "active" : ""}`}>
              <div className="verif-instr">
                <div className="verif-instr-title">What you'll need</div>
                <ul className="verif-instr-tips">
                  <li>A valid government ID — passport, driver's licence or national ID.</li>
                  <li>A clear selfie in good lighting: no sunglasses, hats or filters.</li>
                  <li>Photos go to a private bucket and are reviewed only by the DUYS team.</li>
                </ul>
              </div>
              <div className="verif-wiz-actions">
                <button className="btn btn-primary btn-block" onClick={() => setStep(1)}>Start</button>
              </div>
            </div>

            <div className={`verif-wiz-step ${step === 1 ? "active" : ""}`}>
              <form onSubmit={submitIdentity}>
                <label className="verif-file-label">
                  <span>ID photo</span>
                  <input type="file" accept="image/*" onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} />
                </label>
                <label className="verif-file-label">
                  <span>Selfie</span>
                  <input type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} />
                </label>
                <label className="verif-file-label">
                  <span>Nationality</span>
                  <input type="text" value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g. Ghanaian" />
                </label>
                <label className="verif-file-label">
                  <span>ID type</span>
                  <select value={idType} onChange={(e) => setIdType(e.target.value)}>
                    <option value="passport">Passport</option>
                    <option value="drivers_license">Driver's licence</option>
                    <option value="national_id">National ID</option>
                  </select>
                </label>
                <div className="verif-wiz-actions">
                  <button type="button" className="btn" onClick={() => setStep(0)}>Back</button>
                  <BusyButton className="btn btn-primary" type="submit" busy={busy} busyLabel="Submitting…">Submit for review</BusyButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}



import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Icon } from "../../components/Icon";
import { PageError, PageLoading } from "../../components/PageState";

type Listing = {
  id: number;
  title: string;
  description: string;
  priceDuys: number;
  fileUrl: string;
  active: boolean;
};

/** Mirrors DUYS/duys/templates/shop/seller.html. */
export function ShopPage() {
  const { username } = useParams();
  const { boot } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState<{ seller: { username: string; displayName: string }; listings: Listing[]; owned: number[] } | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = () => api(`/api/shop/${username}`)
    .then((d) => { setData(d); setLoadErr(""); })
    .catch((ex) => setLoadErr((ex as Error).message || "Could not load this shop."));
  useEffect(() => { void load(); }, [username]);
  if (loadErr) return <PageError message={loadErr} onRetry={() => void load()} />;
  if (!data) return <PageLoading label="Loading shop…" />;
  if (!boot?.user) return <PageLoading />;
  const isSelf = data.seller?.username === boot.user.username;
  const canSell = isSelf && Boolean(boot.user.verifiedBadge);
  const fmt = (p: number) => (p > 0 ? `${Number(p).toFixed(4)} DUYS` : "Free");

  async function createListing(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.append("file", file);
      await api(`/api/shop/${username}/create`, { method: "POST", body: fd });
      (e.target as HTMLFormElement).reset();
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await load();
    } catch (ex) {
      window.alert((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function buyListing(id: number) {
    try {
      const r = await api(`/api/shop/listings/${id}/buy`, { method: "POST", body: "{}" });
      const fileUrl = (r as { fileUrl?: string }).fileUrl;
      await load();
      if (fileUrl) window.open(fileUrl, "_blank");
    } catch (ex) {
      window.alert((ex as Error).message);
    }
  }

  return (
    <>
      <div className="page-head glass-bar">
        <button className="icon-btn" onClick={() => nav(-1)} title="Back"><Icon name="chevron" size={22} /></button>
        <div>
          <h1>{data.seller?.displayName}'s Shop</h1>
          <small className="muted">{data.listings.length} item{data.listings.length === 1 ? "" : "s"}</small>
        </div>
      </div>

      {canSell && (
        <div className="shop-create-section">
          <h3>Add a new item</h3>
          <form className="shop-create-form" onSubmit={createListing}>
            <div className="shop-form-row">
              <input type="text" name="title" placeholder="Title" maxLength={128} required className="shop-input" />
            </div>
            <div className="shop-form-row">
              <textarea name="description" placeholder="Description (optional)" maxLength={1000} className="shop-textarea" />
            </div>
            <div className="shop-form-row shop-form-inline">
              <label className="shop-file-label">
                <Icon name="image" size={18} /> {file ? file.name : "Choose file"}
                <input
                  type="file"
                  required
                  className="shop-file-input"
                  ref={fileInput}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <div className="shop-price-wrap">
                <input type="number" name="priceDuys" placeholder="Price in DUYS" min={0} step="0.0001" defaultValue={0} className="shop-price-input" />
                <span className="shop-price-unit">DUYS</span>
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create listing"}</button>
            </div>
          </form>
        </div>
      )}

      {data.listings.length > 0 ? (
        <div className="shop-grid">
          {data.listings.map((item) => {
            const owned = data.owned.includes(item.id);
            return (
              <div className={`shop-card ${item.active ? "" : "shop-card-inactive"}`} key={item.id}>
                <div className="shop-card-body">
                  <div className="shop-card-title">{item.title}</div>
                  {item.description && (
                    <p className="shop-card-desc">
                      {item.description.slice(0, 120)}{item.description.length > 120 ? "…" : ""}
                    </p>
                  )}
                  <div className="shop-card-price">{fmt(item.priceDuys)}</div>
                </div>
                <div className="shop-card-footer">
                  {isSelf ? (
                    <a className="btn btn-sm btn-secondary" href={item.fileUrl} target="_blank" rel="noreferrer">
                      <Icon name="download" size={14} /> Preview
                    </a>
                  ) : owned ? (
                    <>
                      <a className="btn btn-sm btn-primary" href={item.fileUrl} target="_blank" rel="noreferrer">
                        <Icon name="download" size={14} /> Download
                      </a>
                      <span className="shop-owned-badge">Owned</span>
                    </>
                  ) : (
                    <button className="btn btn-sm btn-primary shop-buy-btn" onClick={() => void buyListing(item.id)}>
                      {item.priceDuys > 0 ? `Buy · ${Number(item.priceDuys).toFixed(4)} DUYS` : "Get Free"}
                    </button>
                  )}
                </div>
                {!item.active && isSelf && <div className="shop-inactive-label">Inactive</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="coins" size={48} />
          <h3>{isSelf ? "No listings yet. Create one above!" : "No items in shop."}</h3>
        </div>
      )}
    </>
  );
}



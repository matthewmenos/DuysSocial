import { useAdmin } from "./useAdmin";

type RowAction = { label: string; style?: string; call: (row: unknown) => Promise<unknown> | unknown };

export function AdminTable({
  title,
  path,
  idKey = "id",
  actions = [] as RowAction[],
}: {
  title: string;
  path: string;
  idKey?: string;
  actions?: RowAction[];
}) {
  const { data, load } = useAdmin(path);
  const rows = data ? (data[Object.keys(data)[0]] as any[]) : [];
  if (!data) return null;
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].slice(0, 6);
  return (
    <div>
      <h1>{title} <button className="btn btn-sm" onClick={load}>Refresh</button></h1>
      {!rows.length && <p className="muted">No rows yet.</p>}
      {rows.length > 0 && (
        <table className="admin-table">
          <thead><tr><th>{idKey}</th>{cols.filter((c) => c !== idKey).map((c) => <th key={c}>{c}</th>)}<th>Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r[idKey])}>
                <td>{r[idKey]}</td>
                {cols.filter((c) => c !== idKey).map((c) => (
                  <td key={c} style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {typeof r[c] === "object" ? JSON.stringify(r[c]).slice(0, 60) : String(r[c]).slice(0, 80)}
                  </td>
                ))}
                <td>
                  {actions.map((a) => (
                    <button key={a.label} className={`btn btn-sm ${a.style || ""}`} onClick={async () => { await a.call(r); load(); }}>{a.label}</button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

import { useAdmin } from "./useAdmin";

export function AdminOverview() {
  const { data } = useAdmin("/api/admin/overview");
  if (!data) return null;
  return (
    <div>
      <h1>Overview</h1>
      <p>Users {data.users} · Posts {data.posts} · Open reports {data.reports} · Pending verifications {data.pendingVerif}</p>
    </div>
  );
}

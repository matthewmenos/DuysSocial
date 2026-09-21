import { useAdmin } from "./useAdmin";
import { PageError, PageLoading } from "../../components/PageState";

export function AdminOverview() {
  const { data, load, error } = useAdmin("/api/admin/overview");
  if (error) return <PageError message={error} onRetry={() => void load()} />;
  if (!data) return <PageLoading label="Loading overview…" />;
  return (
    <div>
      <h1>Overview</h1>
      <p>Users {data.users} · Posts {data.posts} · Open reports {data.reports} · Pending verifications {data.pendingVerif}</p>
    </div>
  );
}

import { useAdmin } from "./useAdmin";

export function AdminAnalytics() {
  const { data } = useAdmin("/api/admin/analytics");
  return <div><h1>Analytics</h1><pre>{JSON.stringify(data, null, 2)}</pre></div>;
}

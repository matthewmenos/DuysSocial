import { useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import { Icon } from "../../components/Icon";
import { PageLoading } from "../../components/PageState";

const links = [
  ["Overview", "/admin"],
  ["Analytics", "/admin/analytics"],
  ["Users", "/admin/users"],
  ["Posts", "/admin/posts"],
  ["Comments", "/admin/comments"],
  ["Stories", "/admin/stories"],
  ["Live", "/admin/live"],
  ["Channels", "/admin/channels"],
  ["Groups", "/admin/groups"],
  ["Reports", "/admin/reports"],
  ["Verifications", "/admin/verifications"],
  ["Entity verifications", "/admin/entity-verifications"],
  ["Finance", "/admin/finance"],
  ["Subscriptions", "/admin/subscriptions"],
  ["Economy", "/admin/economy"],
  ["Blockchain", "/admin/blockchain"],
  ["Boosts", "/admin/boosts"],
  ["Broadcast", "/admin/broadcast"],
  ["Settings", "/admin/settings"],
  ["Features", "/admin/features"],
  ["Activity", "/admin/activity"],
  ["Content", "/admin/content"],
];

export function AdminShell() {
  const { boot, loading } = useAuth();
  const nav = useNavigate();

  // /admin sits outside AppShell, so it must do its own gate. Without this a
  // refresh (or a non-admin visiting the URL) rendered the panel shell while
  // every admin API call 403'd — i.e. a blank screen.
  useEffect(() => {
    if (loading) return;
    if (!boot?.user) nav("/auth/login", { replace: true });
    else if (!boot.user.isAdmin) nav("/", { replace: true });
  }, [boot, loading, nav]);

  if (loading) return <PageLoading label="Checking access…" />;
  if (!boot?.user || !boot.user.isAdmin) return <PageLoading label="Redirecting…" />;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <Link className="admin-brand" to="/admin"><span>Control Panel</span></Link>
        </div>
        <nav className="admin-nav-list">
          {links.map(([l, h]) => (
            <NavLink key={h} className="admin-nav-item" to={h} end={h === "/admin"}>{l}</NavLink>
          ))}
        </nav>
        <Link className="admin-nav-item" to="/"><Icon name="home" size={16} /> Back to app</Link>
      </aside>
      <main className="admin-main" style={{ padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}

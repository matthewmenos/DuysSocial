import { Link, NavLink, Outlet } from "react-router-dom";
import { Icon } from "../../components/Icon";

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

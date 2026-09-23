import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { socket } from "../socket";
import { Avatar, Badge, Icon } from "./Icon";
import { Composer } from "./Composer";
import { CallOverlay } from "./CallOverlay";
import { PageLoading } from "./PageState";

/** Routes that render without a signed-in user (everything else redirects). */
function isPublicRoute(pathname: string) {
  if (pathname.startsWith("/auth") || pathname.startsWith("/legal")) return true;
  return pathname === "/explore" || pathname.startsWith("/posts/");
}

export function AppShell() {
  const { boot, refresh, loading, setTheme } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  // Anonymous users must leave protected routes immediately. Boot is null only
  // on the very first load, so the redirect fires as soon as the session check
  // resolves (replace:true keeps / off the back-button stack).
  useEffect(() => {
    if (!loading && boot && !boot.user && !isPublicRoute(loc.pathname)) {
      nav("/auth/login", { replace: true });
    }
  }, [boot?.user, loading, loc.pathname, nav]);
  const [composer, setComposer] = useState(false);
  const [tray, setTray] = useState(false);
  const [notifs, setNotifs] = useState<{ id: number; text: string; isRead: boolean }[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = boot?.user;

  if (!boot || loading) return <PageLoading label="Starting DUYS…" />;
  // Protected pages render a placeholder while the redirect above takes
  // effect, instead of flashing their fetch-then-fail states.
  if (!user) {
    return isPublicRoute(loc.pathname)
      ? <Outlet />
      : <PageLoading label="Redirecting to login…" rows={0} />;
  }
  const me = user;

  // presence ping — guard with optional chaining so the effect is safe when
  // user is still undefined on the initial render.
  useEffect(() => {
    socket.emit("presence", user?.id);
    return () => { socket.emit("presence", null); };
  }, [user?.id]);

  const active = (name: string) => loc.pathname === name || loc.pathname.startsWith(name + "/");

  async function toggleTheme() {
    const next = (me.theme === "dark" ? "light" : "dark");
    setTheme(next);
    const fd = new FormData();
    fd.append("theme", next);
    await api("/api/settings/theme", { method: "POST", body: JSON.stringify({ theme: next }), headers: { "Content-Type": "application/json" } }).catch(() => {});
  }

  async function openNotifs() {
    setTray(true);
    const data = await api("/api/notifications/tray");
    setNotifs(data.notifications || []);
    await api("/api/notifications/read", { method: "POST", body: "{}" });
    refresh();
  }

  return (
    <>
      {boot.announcementEnabled && boot.announcementText && (
        <div className="announcement-banner">
          <span>{boot.announcementText}</span>
        </div>
      )}
      <div className="app-shell">
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} id="sidebar">
          <div className="brand-row">
            <NavLink className="brand" to="/">
              <img className="brand-logo" src="/icons/favicon.svg" width={32} height={32} alt={boot.appName} />
              <span className="brand-text">{boot.appName}</span>
            </NavLink>
            <button className="sidebar-collapse-btn" onClick={() => document.body.classList.toggle("sidebar-mini")}>
              <Icon name="chevron" size={18} />
            </button>
          </div>
          <nav className="side-nav">
            <NavLink className={`nav-link ${loc.pathname === "/" ? "active" : ""}`} to="/" data-label="Home">
              <Icon name="home" /><span>Home</span>
            </NavLink>
            <div className={`nav-group ${active("/messages") || active("/live") ? "open" : ""}`}>
              <button className="nav-link nav-toggle" onClick={(e) => e.currentTarget.parentElement?.classList.toggle("open")}>
                <Icon name="mail" /><span>Messages</span><Icon name="chevron" size={18} />
                {boot.unreadMessages > 0 && <span className="nav-dot" />}
              </button>
              <div className="nav-sub">
                <NavLink className="nav-link" to="/messages"><Icon name="mail" size={20} /><span>Messages</span>
                  {boot.unreadMessages > 0 && <span className="nav-count">{boot.unreadMessages}</span>}
                </NavLink>
                <NavLink className="nav-link" to="/live"><Icon name="video" size={20} /><span>Live & Spaces</span></NavLink>
              </div>
            </div>
            <div className={`nav-group ${["/wallet","/earn","/referral","/leaderboard","/verification"].some(active) ? "open" : ""}`}>
              <button className="nav-link nav-toggle" onClick={(e) => e.currentTarget.parentElement?.classList.toggle("open")}>
                <Icon name="wallet" /><span>Earn & Wallet</span><Icon name="chevron" size={18} />
              </button>
              <div className="nav-sub">
                <NavLink className="nav-link" to="/wallet"><Icon name="wallet" size={20} /><span>Wallet</span></NavLink>
                <NavLink className="nav-link" to="/earn"><Icon name="gift" size={20} /><span>Earn / Airdrop</span></NavLink>
                <NavLink className="nav-link" to="/leaderboard"><Icon name="boost" size={20} /><span>Leaderboard</span></NavLink>
                <NavLink className="nav-link" to="/referral"><Icon name="coins" size={20} /><span>Referrals</span></NavLink>
              </div>
            </div>
            <NavLink className="nav-link" to={`/u/${user.username}`}><Icon name="user" /><span>Profile</span></NavLink>
            <NavLink className="nav-link" to="/settings"><Icon name="settings" /><span>Settings</span></NavLink>
            <NavLink className="nav-link" to="/channels"><Icon name="broadcast" /><span>Channels</span></NavLink>
            <NavLink className="nav-link" to="/explore"><Icon name="explore" /><span>Explore</span></NavLink>
            {user.isAdmin && <NavLink className="nav-link" to="/admin"><Icon name="admin" /><span>Admin</span></NavLink>}
          </nav>
          <button className="btn btn-primary btn-post-cta" onClick={() => setComposer(true)}>
            <Icon name="plus" /><span>Post</span>
          </button>
          <div className="side-foot">
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
              <Icon name="sun" size={20} /><Icon name="moon" size={20} />
            </button>
            <NavLink className="side-user" to={`/u/${user.username}`}>
              <Avatar url={user.avatarUrl} size={40} />
              <span className="side-user-info">
                <strong>{user.displayName}<Badge kind={user.verifiedBadge} /></strong>
                <small>{user.points} $DUYS</small>
              </span>
            </NavLink>
            <button className="icon-btn" title="Notifications" onClick={openNotifs}><Icon name="bell" size={20} /></button>
            <button className="icon-btn" title="Log out" onClick={async () => { await api("/api/auth/logout", { method: "POST", body: "{}" }); refresh(); nav("/auth/login"); }}>
              <Icon name="logout" size={20} />
            </button>
          </div>
        </aside>
        <main className="content">
          <button className="mobile-menu" onClick={() => setSidebarOpen((v) => !v)}><Icon name="menu" /></button>
          <Outlet context={{ openComposer: () => setComposer(true) }} />
        </main>
        <aside className="rail" />
      </div>
      <nav className="glass-nav">
        <NavLink className={`glass-item ${loc.pathname === "/" ? "active" : ""}`} to="/" title="Home"><Icon name="home" /></NavLink>
        <NavLink className="glass-item" to="/wallet" title="Wallet"><Icon name="wallet" /></NavLink>
        <button className="glass-item glass-fab" onClick={() => setComposer(true)} title="Post"><Icon name="plus" /></button>
        <NavLink className="glass-item" to="/messages" title="Messages">
          <Icon name="comment" />
          {boot.unreadMessages > 0 && <span className="glass-badge">{boot.unreadMessages}</span>}
        </NavLink>
        <NavLink className="glass-item" to={`/u/${user.username}`} title="Profile"><Icon name="user" /></NavLink>
      </nav>
      {tray && (
        <div className="notif-drop" onClick={() => setTray(false)}>
          <div className="notif-drop-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Notifications</h3>
            {notifs.map((n) => (
              <div key={n.id} className="notif-row">{n.text}</div>
            ))}
            {!notifs.length && <p className="muted">No notifications yet.</p>}
            <NavLink to="/notifications" onClick={() => setTray(false)}>See all</NavLink>
          </div>
        </div>
      )}
      {composer && <Composer onClose={() => setComposer(false)} onPosted={() => { setComposer(false); refresh(); }} limit={Number(boot.postCharLimit)} />}
      <CallOverlay />
    </>
  );
}

import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, ClipboardList, FileText, FolderKanban, LayoutDashboard, LogOut, Menu, Search, Settings, Users, X } from "lucide-react";
import { useAuth } from "../lib/auth.jsx";
import { api, json } from "../lib/api.js";
import { Avatar } from "./common.jsx";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "My projects", icon: FolderKanban },
  { to: "/tasks", label: "All tasks", icon: ClipboardList },
  { to: "/team", label: "Team members", icon: Users },
  { to: "/notes", label: "Project notes", icon: FileText },
];

export default function AppShell() {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  async function loadNotifications() {
    try {
      const result = await api("/notifications");
      setNotifications(result?.items ?? []);
      setUnreadCount(result?.unreadCount ?? 0);
    } catch { /* Authentication or network errors should not block workspace navigation. */ }
  }

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function openNotification(notification) {
    if (!notification.readAt) {
      try { await api(`/notifications/${notification._id}/read`, json("PATCH", {})); } catch { /* Continue to the linked item. */ }
      setNotifications((items) => items.map((item) => item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    setNotificationsOpen(false);
    if (notification.entityType === "task" && notification.project?._id && notification.entityId) navigate(`/tasks/${notification.project._id}/${notification.entityId}`);
    else if (notification.project?._id) navigate(`/projects/${notification.project._id}${notification.entityType === "note" ? "?tab=notes" : ""}`);
    else navigate("/dashboard");
  }

  async function markAllRead() {
    try { await api("/notifications/read-all", json("PATCH", {})); } catch { return; }
    setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    setUnreadCount(0);
  }

  async function logout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  const sidebar = <>
    <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="brand"><span className="brand-mark"><FolderKanban size={21} strokeWidth={2.2} /></span><span>TaskForge</span></Link>
    <p className="sidebar-label">WORKSPACE</p>
    <nav className="side-nav" aria-label="Main navigation">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}><Icon size={19} strokeWidth={1.8} /><span>{label}</span></NavLink>)}</nav>
    <div className="sidebar-bottom"><div className="sidebar-rule" /><NavLink to="/settings" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}><Settings size={19} strokeWidth={1.8} /><span>Settings</span></NavLink><div className="sidebar-tip"><span className="tip-dot" />A little progress, every day.</div></div>
  </>;

  return <div className="app-frame">
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="desktop-sidebar-content">{sidebar}</div>
    </aside>
    <div className="workspace-main">
      <header className="topbar">
        <button className="icon-button mobile-menu-button" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
        <form className="global-search" onSubmit={(event) => { event.preventDefault(); navigate(`/tasks${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`); }}><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks and projects" aria-label="Search tasks and projects" />{query && <button type="button" className="search-clear" onClick={() => setQuery("")}><X size={15} /></button>}<kbd>↵</kbd></form>
        <div className="topbar-spacer" />
        <div className="notification-wrap"><button className="icon-button notification-button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); setMenuOpen(false); if (!notificationsOpen) loadNotifications(); }}><Bell size={19} />{unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>{notificationsOpen && <section className="notification-popover" aria-label="Notifications"><header><strong>Notifications</strong>{unreadCount > 0 && <button className="notification-mark-read" onClick={markAllRead}>Mark all read</button>}</header><div className="notification-list">{notifications.length ? notifications.map((item) => <button key={item._id} className={`notification-item ${item.readAt ? "" : "notification-unread"}`} onClick={() => openNotification(item)}><span className="notification-message">{item.message}</span><small>{item.project?.name || "TaskForge"} · {new Date(item.createdAt).toLocaleString()}</small></button>) : <p className="notification-empty">You’re all caught up.</p>}</div></section>}</div>
        <div className="profile-menu-wrap"><button className="profile-trigger" onClick={() => { setMenuOpen(!menuOpen); setNotificationsOpen(false); }} aria-expanded={menuOpen}><Avatar user={user} /><span className="profile-name">{user?.fullName || user?.username}</span><ChevronDown size={16} /></button>{menuOpen && <div className="profile-dropdown"><div className="dropdown-identity"><strong>{user?.fullName || user?.username}</strong><span>{user?.email}</span></div><Link to="/settings" onClick={() => setMenuOpen(false)}><Settings size={16} />Settings</Link><button onClick={logout}><LogOut size={16} />Sign out</button></div>}</div>
      </header>
      <main className="page-content"><Outlet /></main>
      <footer className="app-footer"><span>TaskForge</span><span>Make meaningful progress.</span></footer>
    </div>
  </div>;
}

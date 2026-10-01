import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import avensonsLogo from "../../assets/avensons_sales.png";
import UserMenu from "../../components/UserMenu.jsx";
import Overview from "./Overview.jsx";
import Users from "./Users.jsx";

const ICONS = {
  overview: <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2.5" y="2.5" width="7" height="8" rx="1.3" /><rect x="10.5" y="2.5" width="7" height="5" rx="1.3" /><rect x="10.5" y="9" width="7" height="8.5" rx="1.3" /><rect x="2.5" y="12" width="7" height="5.5" rx="1.3" /></svg>,
  users: <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="3" /><path d="M2 17c0-3 2.2-5 5-5s5 2 5 5" strokeLinecap="round" /><circle cx="15" cy="8" r="2.4" /><path d="M13.2 12c2 0 4.3 1.5 4.3 5" strokeLinecap="round" /></svg>,
};

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
];

export default function SuperAdminApp() {
  const { auth } = useAuth();
  const [view, setView] = useState({ page: "overview" });
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sg_admin_sidebar_collapsed") === "1"
  );

  useEffect(() => {
    localStorage.setItem("sg_admin_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div className={`shell${collapsed ? " collapsed" : ""}`}>
      <nav className="side">
        <div className="brand">
          <div className="brand-logo-frame"><img src={avensonsLogo} alt="Avensons Ventures" className="brand-logo" /></div>
          {!collapsed && <strong>Avensons Ventures</strong>}
        </div>

        <button
          className="sidebar-toggle-inline"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "»" : "«"}
        </button>

        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className="nav-item"
            aria-current={view.page === item.id}
            title={collapsed ? item.label : undefined}
            onClick={() => setView({ page: item.id })}
          >
            <span className="nav-item-content">
              <span className="nav-icon">{ICONS[item.id]}</span>
              {!collapsed && <span>{item.label}</span>}
            </span>
          </button>
        ))}
      </nav>

      <div className="content-col">
        <header className="mainbar" style={{ justifyContent: "space-between" }}>
          <h1 style={{ margin: 0 }}>Hi, {auth?.user?.name ?? "Super Admin"}</h1>
          <UserMenu />
        </header>

        <main className="main">
          {view.page === "overview" && <Overview />}
          {view.page === "users" && <Users />}
        </main>
      </div>
    </div>
  );
}
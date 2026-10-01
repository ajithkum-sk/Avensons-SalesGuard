import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import avensonsLogo from "../../assets/avensons_sales.png";
import UserMenu from "../../components/UserMenu.jsx";
import SPDashboard from "./SPDashboard.jsx";
import MyShops from "./MyShops.jsx";
import Notifications from "./Notifications.jsx";
import ShopDetails from "./ShopDetails.jsx";
import CollectionHistory from "./CollectionHistory.jsx";
import Profile from "./Profile.jsx";

const ICONS = {
  dashboard: <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2.5" y="2.5" width="7" height="8" rx="1.3" /><rect x="10.5" y="2.5" width="7" height="5" rx="1.3" /><rect x="10.5" y="9" width="7" height="8.5" rx="1.3" /><rect x="2.5" y="12" width="7" height="5.5" rx="1.3" /></svg>,
  shops: <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 6h14l-1.4 8.4a1.5 1.5 0 0 1-1.5 1.3H5.9a1.5 1.5 0 0 1-1.5-1.3L3 6Z" strokeLinejoin="round" /><path d="M6 6V4.5A2.5 2.5 0 0 1 8.5 2h3A2.5 2.5 0 0 1 14 4.5V6" /></svg>,
  notifications: <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 8a5 5 0 0 1 10 0c0 3.5 1.2 4.5 1.2 4.5H3.8S5 11.5 5 8Z" strokeLinejoin="round" /><path d="M8 15.5a2 2 0 0 0 4 0" /></svg>,
  shopDetails: <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="14" height="12" rx="1.3" /><path d="M6 8h8M6 11h8M6 14h5" strokeLinecap="round" /></svg>,
  history: <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  profile: <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="7" r="3" /><path d="M4 17c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" strokeLinecap="round" /></svg>,
};

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "shops", label: "My Shops" },
  { id: "notifications", label: "Notifications" },
  { id: "shopDetails", label: "Shop Details" },
  { id: "history", label: "Collection History" },
  { id: "profile", label: "Profile" },
];

export default function SalespersonApp() {
  const { auth, logout } = useAuth();
  const [view, setView] = useState({ page: "dashboard" });
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sg_sp_sidebar_collapsed") === "1"
  );

  useEffect(() => {
    localStorage.setItem("sg_sp_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const goTo = (page, extra = {}) => setView({ page, ...extra });
  const openShop = (customerCode) => goTo("shopDetails", { customerCode });
  const handleLogout = () => { logout(); };

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
            onClick={() => goTo(item.id)}
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
          <h1 style={{ margin: 0 }}>Hi, {auth?.user?.name ?? "Salesperson"}</h1>
          <UserMenu />
        </header>

        <main className="main">
          {view.page === "dashboard" && (
            <SPDashboard onOpenShop={openShop} onViewAllShops={() => goTo("shops")} onOpenFlag={(ruleCode) => goTo("shops", { flag: ruleCode })} />
          )}
          {view.page === "shops" && <MyShops flag={view.flag} onOpenShop={openShop} />}
          {view.page === "notifications" && <Notifications />}
          {view.page === "shopDetails" && <ShopDetails customerCode={view.customerCode} onBack={() => goTo("shops")} />}
          {view.page === "history" && <CollectionHistory />}
          {view.page === "profile" && <Profile onLogout={handleLogout} />}
        </main>
      </div>
    </div>
  );
}
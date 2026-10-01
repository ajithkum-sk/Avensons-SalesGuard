import React, { useCallback, useEffect, useState } from "react";
import { api, count } from "./api.js";
import Dashboard from "./pages/Dashboard.jsx";
import Violations from "./pages/Violations.jsx";
import Salesmen from "./pages/Salesmen.jsx";
import Settings from "./pages/Settings.jsx";
import Data from "./pages/Data.jsx";
import Help from "./pages/Help.jsx";
import UserMenu from "./components/UserMenu.jsx";
import avensonsLogo from "./assets/avensons_sales.png";


const ICONS = {
  dashboard: (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2.5" y="2.5" width="7" height="8" rx="1.3" />
      <rect x="10.5" y="2.5" width="7" height="5" rx="1.3" />
      <rect x="10.5" y="9" width="7" height="8.5" rx="1.3" />
      <rect x="2.5" y="12" width="7" height="5.5" rx="1.3" />
    </svg>
  ),
  salesmen: (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="7.5" cy="6.5" r="2.5" />
      <path d="M2.5 16.5c0-2.8 2.2-5 5-5s5 2.2 5 5" strokeLinecap="round" />
      <circle cx="14.5" cy="6" r="2" />
      <path d="M13 11.6c2.2.3 3.9 2.2 4 4.9" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 5.5h8M4 10h12M4 14.5h8" strokeLinecap="round" />
      <circle cx="14" cy="5.5" r="1.7" />
      <circle cx="8" cy="14.5" r="1.7" />
    </svg>
  ),
  data: (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10 13V4M6.5 7.5 10 4l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 14.5v1.2c0 .7.6 1.3 1.3 1.3h10.4c.7 0 1.3-.6 1.3-1.3v-1.2" strokeLinecap="round" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="10" r="7.3" />
      <path d="M7.7 7.8a2.3 2.3 0 1 1 3.4 2c-.8.5-1.1 1-1.1 1.9" strokeLinecap="round" />
      <circle cx="10" cy="14.2" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { id: "data", label: "Upload" },
  { id: "dashboard", label: "Dashboard" },
  { id: "settings", label: "Configuration" },
  { id: "salesmen", label: "Salesmen" },
  { id: "help", label: "Help" },
];

export default function ManagerApp() {
  const [view, setView] = useState({ page: "data" });
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sg_sidebar_collapsed") === "1"
  );
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");

  const refresh = useCallback(async (rid = null) => {
    setLoading(true);
    try {
      setSummary(await api.dashboard(rid, locationId || null));
      setError(null);
    } catch (err) {
      setSummary(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    api.locations().then(setLocations).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem("sg_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const rules = summary?.by_rule ?? [];
  const openRule = (code) => setView({ page: "violations", ruleCode: code });
  const showRunSalesmen = (id) => {
    setView({ page: "salesmen" });
    refresh(id);
  };
  const showMonthlySalesmen = (month) => {
    setView({ page: "salesmen", monthlyMonth: month });
  };
  const goTo = (page) => setView({ page });

  return (
    <div className={`shell${collapsed ? " collapsed" : ""}`}>
      <nav className="side">
        <div className="brand">
          <div className="brand-logo-frame">
            <img src={avensonsLogo} alt="Avensons Ventures" className="brand-logo" />
          </div>
          {!collapsed && <strong>Avensons Ventures</strong>}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px" }}>
          {!collapsed && <span className="nav-group" style={{ margin: 0 }}>Lists</span>}
          <button
            className="sidebar-toggle-inline"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{ margin: 0 }}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        {!collapsed && (
          <>
            {rules.map((r) => (
              <button
                key={r.rule_code}
                className={`nav-item${r.is_enabled === false ? " nav-item-disabled" : ""}`}
                aria-current={view.page === "violations" && view.ruleCode === r.rule_code}
                onClick={() => openRule(r.rule_code)}
                title={r.is_enabled === false ? "This rule is turned off in Configuration" : undefined}
              >
                <span>{r.title}</span>
                <span className="tally">
                  {r.status === "skipped" ? "—" : count(r.hits)}
                </span>
              </button>
            ))}
          </>
        )}
      </nav>

      <div className="content-col">
        {view.page === "violations" && <div className="hover-zone-top" />}
        <header 
          className={`mainbar${view.page === "violations" ? " mainbar-autohide" : ""}`}
          style={{ justifyContent: "space-between"}}
        >
          <div style={{ display: "flex" }}>
            {view.page === "violations" ? (
              <button
                className="mainbar-item"
                onClick={() => {
                  setView({ page: "dashboard" });
                  refresh();
                }}
              >
                <span className="nav-icon">{ICONS.dashboard}</span>
                <span>Home</span>
              </button>
            ) : (
              NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  className="mainbar-item"
                  aria-current={view.page === item.id}
                  onClick={() => {
                    setView({ page: item.id });
                    if (item.id === "dashboard") refresh();
                  }}
                >
                  <span className="nav-icon">{ICONS[item.id]}</span>
                  <span>{item.label}</span>
                </button>
              ))
            )}
          </div>
          <div className="toolbar" style={{ gap: 8 }}>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : "")}
              aria-label="Location"
            >
              <option value="">All locations</option>
              {locations.map((loc) => (
                <option key={loc.location_id} value={loc.location_id}>{loc.name}</option>
              ))}
            </select>
            <UserMenu />
          </div>
        </header>

        <main className="main">
          {error && (
            <div className="error">
              {error}
              {error.includes("No successful rule run") && (
                <> Upload an outstanding report on the <button className="linkbtn" onClick={() => setView({ page: "data" })}>Upload</button> screen to get started.</>
              )}
            </div>
          )}

          {view.page === "dashboard" && (
            <Dashboard summary={summary} loading={loading} onRefresh={refresh} onOpenRule={openRule} onBack={() => goTo("data")} />
          )}
          {view.page === "violations" && (
            <Violations
              ruleCode={view.ruleCode}
              rule={rules.find((r) => r.rule_code === view.ruleCode)}
              onBack={() => goTo("dashboard")}
              locationId={locationId || null}
            />
          )}
          {view.page === "salesmen" && (
            <Salesmen
              onOpenRule={openRule}
              onBack={() => goTo(view.monthlyMonth ? "data" : "dashboard")}
              monthlyMonth={view.monthlyMonth}
              locationId={locationId || null}
            />
          )}
          {view.page === "settings" && <Settings onSaved={refresh} onBack={() => goTo("dashboard")} />}
          {view.page === "data" && (
            <Data onLoaded={refresh} onShowSalesmen={showRunSalesmen} onShowMonthlySalesmen={showMonthlySalesmen} />
          )}
          {view.page === "help" && <Help />}
        </main>
      </div>
    </div>
  );
}
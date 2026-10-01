import React, { useEffect, useState } from "react";
import { count, money } from "../../api.js";
import { salespersonApi } from "../../api/salespersonApi.js";
import StatusPill from "./StatusPill.jsx";

const HIDDEN_RULE_CODES = ["R08_CHRONIC_DEFAULT_CUSTOMER"];
function PerformanceCard({ performance }) {
  if (!performance) return null;
  const { this_month_collected: thisMonth, last_month_collected: lastMonth, trend = [] } = performance;
  const change = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null;
  const max = Math.max(1, ...trend.map((t) => t.amount));
  const CHART_HEIGHT = 90;

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h2 style={{ marginBottom: 16 }}>My Performance</h2>

      <div className="grid k2" style={{ marginBottom: 24 }}>
        <div>
          <div className="label">This Month Collected</div>
          <div className="value">{money(thisMonth)}</div>
          {change != null && (
            <span className="pill" style={{ color: change >= 0 ? "var(--ok)" : "var(--danger)" }}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(0)}% vs last month
            </span>
          )}
        </div>
        <div>
          <div className="label">Last Month Collected</div>
          <div className="value">{money(lastMonth)}</div>
        </div>
      </div>

      {trend.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            borderBottom: "1px solid var(--line)",
            paddingBottom: 8,
          }}
        >
          {trend.map((t, i) => {
            const isCurrent = i === trend.length - 1;
            const barHeight = t.amount > 0 ? Math.max(Math.round((t.amount / max) * CHART_HEIGHT), 4) : 2;
            return (
              <div
                key={`${t.label}-${i}`}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  height: CHART_HEIGHT + 24,
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: isCurrent ? 700 : 600,
                    color: isCurrent ? "var(--ink)" : "var(--ink-soft)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.amount > 0 ? money(t.amount) : "—"}
                </div>
                <div
                  title={`${t.label}: ${money(t.amount)}`}
                  style={{
                    width: "60%",
                    maxWidth: 32,
                    height: barHeight,
                    background: "var(--accent)",
                    opacity: isCurrent ? 1 : 0.55,
                    borderRadius: "4px 4px 0 0",
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
      {trend.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          {trend.map((t, i) => (
            <div
              key={`${t.label}-lbl-${i}`}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 12,
                fontWeight: i === trend.length - 1 ? 700 : 600,
                color: i === trend.length - 1 ? "var(--ink)" : "var(--ink-soft)",
              }}
            >
              {t.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SPDashboard({ onOpenShop, onViewAllShops, onOpenFlag }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    salespersonApi.dashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="empty">Loading your dashboard…</div>;

  const { totals, by_rule = [], priority_shops = [], performance } = data;
  const visibleRules = by_rule.filter((r) => !HIDDEN_RULE_CODES.includes(r.rule_code));

  return (
    <>
      <div className="topbar">
        <h2>Your outstanding, at a glance</h2>
        {data.location && <span className="meta">Location — {data.location}</span>}
      </div>

      <div className="grid k4" style={{ marginBottom: 18 }}>
        <div className="card stat"><div className="label">Total Due</div><div className="value">{money(totals.total_due)}</div></div>
        <div className="card stat risk"><div className="label">Overdue</div><div className="value">{money(totals.overdue)}</div></div>
        <div className="card stat risk"><div className="label">High Risk Shops</div><div className="value">{count(totals.high_risk_shops)}</div></div>
        <div className="card stat"><div className="label">Good Outlets</div><div className="value">{count(totals.good_outlets)}</div></div>
      </div>

      <PerformanceCard performance={performance} />

      {visibleRules.length > 0 && (
        <div className="toolbar" style={{ marginBottom: 18, flexWrap: "wrap" }}>
          {visibleRules.map((r) => (
            <button key={r.rule_code} className="ghost" onClick={() => onOpenFlag(r.rule_code)}>
              {r.title} {r.hits != null && <span className="tally">({count(r.hits)})</span>}
            </button>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Priority Shops</h2>
          <button className="linkbtn" onClick={onViewAllShops}>View All →</button>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Shop Name</th><th className="num">Outstanding</th><th className="num">Due Days</th><th>Status</th></tr></thead>
            <tbody>
              {priority_shops.map((s) => (
                <tr key={s.customer_code} className="row-click" tabIndex={0}
                    onClick={() => onOpenShop(s.customer_code)}
                    onKeyDown={(e) => e.key === "Enter" && onOpenShop(s.customer_code)}>
                  <td>{s.customer_name}</td>
                  <td className="num">{money(s.outstanding)}</td>
                  <td className="num">{s.due_days ?? "—"}</td>
                  <td><StatusPill status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {priority_shops.length === 0 && <div className="empty">No priority shops right now — nice work.</div>}
      </div>
    </>
  );
}
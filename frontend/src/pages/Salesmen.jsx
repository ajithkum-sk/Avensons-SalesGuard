import React, { useEffect, useState } from "react";
import { api, count, money } from "../api.js";

export default function Salesmen({ onOpenRule, onBack, monthlyMonth, locationId }) {
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);

  const isMonthly = Boolean(monthlyMonth);

  useEffect(() => {
    setRows(null);
    setError(null);
    const req = isMonthly ? api.salesmenMonthly(monthlyMonth) : api.salesmen(locationId);
    req
      .then((res) => setRows(isMonthly ? res.rows : res))
      .catch((e) => setError(e.message));
  }, [isMonthly, monthlyMonth, locationId]);

  const shown = (rows ?? []).filter(
    (r) =>
      !search.trim() ||
      r.salesman_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.salesman_type ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {onBack && (
        <button className="back-link" onClick={onBack}>
          <span className="back-arrow">&#8592;</span> Back to Dashboard
        </button>
      )}
      <div className="topbar">
        <h1>Salesmen</h1>
        <span className="meta">
          {isMonthly
            ? `Sales performance for ${monthlyMonth}, vs. each salesman's own 3-month average`
            : "Flags and money at risk from the latest check"}
        </span>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="toolbar">
        <input
          type="search"
          placeholder="Name or type"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300 }}
          aria-label="Search salesmen"
        />
        <span className="spacer" />
        <span className="note">{count(shown.length)} salesmen</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-scroll">
          <table>
            <thead>
              {isMonthly ? (
                <tr>
                  <th>Salesman</th>
                  <th>Type</th>
                  <th className="num">Invoices</th>
                  <th className="num">Sales this month</th>
                  <th className="num">3-month average</th>
                  <th className="num">vs. average</th>
                </tr>
              ) : (
                <tr>
                  <th>Salesman</th>
                  <th>Type</th>
                  <th className="num">Flags</th>
                  <th className="num">Outlets</th>
                  <th className="num">At risk</th>
                </tr>
              )}
            </thead>
            <tbody>
              {isMonthly
                ? shown.map((r) => (
                    <tr key={r.salesman_key}>
                      <td>{r.salesman_name}</td>
                      <td className="note">{r.salesman_type ?? "—"}</td>
                      <td className="num">{count(r.invoices)}</td>
                      <td className="num">{money(r.amount)}</td>
                      <td className="num">{money(r.avg_amount)}</td>
                      <td className="num">{r.pct_of_avg != null ? `${r.pct_of_avg}%` : "—"}</td>
                    </tr>
                  ))
                : shown.map((r) => (
                    <tr key={r.salesman_key}>
                      <td>{r.salesman_name}</td>
                      <td className="note">{r.salesman_type ?? "—"}</td>
                      <td className="num">{count(r.flags)}</td>
                      <td className="num">{count(r.customers)}</td>
                      <td className="num">{money(r.exposure)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {rows && shown.length === 0 && <div className="empty">No salesman matches that.</div>}
      </div>
    </>
  );
}

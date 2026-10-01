import React, { useCallback, useEffect, useState } from "react";
import { api, count, money } from "../api.js";
import CustomerDrawer from "../components/CustomerDrawer.jsx";

const PAGE = 100;

export default function Violations({ ruleCode, rule, onBack, locationId }) {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [outletFilter, setOutletFilter] = useState("");
  const [salesmanFilter, setSalesmanFilter] = useState("");
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState(null);
  const [openCustomer, setOpenCustomer] = useState(null);
  const [minOverdue, setMinOverdue] = useState("");
  const [maxOverdue, setMaxOverdue] = useState("");
  const [exceptions, setExceptions] = useState([]);
  const [showExceptions, setShowExceptions] = useState(false);
  const [allRows, setAllRows] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const params = { rule_code: ruleCode, limit: PAGE, offset };
  if (search.trim()) params.search = search.trim();
  if (outletFilter.trim()) params.customer_search = outletFilter.trim();
  if (salesmanFilter.trim()) params.salesman_search = salesmanFilter.trim();
  if (minOverdue !== "") params.min_overdue_days = minOverdue;
  if (maxOverdue !== "") params.max_overdue_days = maxOverdue;
  if (sortBy) {
    params.sort_by = sortBy;
    params.sort_dir = sortDir;
  }

  const load = useCallback(async () => {
    try {
      const res = await api.violations(params, locationId);
      setData(res);
      setAllRows((prev) => (offset === 0 ? res.rows : [...prev, ...res.rows]));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [ruleCode, search, outletFilter, salesmanFilter, minOverdue, maxOverdue, sortBy, sortDir, offset, locationId]);

  const loadExceptions = useCallback(() => {
    api.exceptions()
      .then((rows) => setExceptions(rows.filter((e) => e.rule_code === ruleCode && e.is_active !== false)))
      .catch(() => {});
  }, [ruleCode]);

  useEffect(() => {
    const isTyping = search || outletFilter || salesmanFilter;
    const timer = setTimeout(load, isTyping ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => { loadExceptions(); }, [loadExceptions]);

  useEffect(() => {
    setOffset(0);
    setAllRows([]);
  }, [ruleCode, search, outletFilter, salesmanFilter, minOverdue, maxOverdue, sortBy, sortDir]);

  const excludeSalesman = async (salesmanKey, salesmanName) => {
    if (!salesmanKey) return;
    if (!window.confirm(`Exclude ${salesmanName} from "${rule?.title ?? ruleCode}" going forward?`)) return;
    try {
      await api.addException({ rule_code: ruleCode, salesman_key: salesmanKey, note: "Excluded from Violations list" });
      loadExceptions();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeException = async (id) => {
    try {
      await api.dropException(id);
      loadExceptions();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  const handleScroll = (e) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    const hasMore = data && allRows.length < data.total;
    if (nearBottom && hasMore && !loadingMore) {
      setLoadingMore(true);
      setOffset((o) => o + PAGE);
    }
  };

  const sortIndicator = (field) => (
    <span className="sort-icons">
      <span className={`sort-icon ${sortBy === field && sortDir === "asc" ? "active" : ""}`}>▲</span>
      <span className={`sort-icon ${sortBy === field && sortDir === "desc" ? "active" : ""}`}>▼</span>
    </span>
  );

  return (
    <>
      <div className="topbar">
        <h1>{rule?.title ?? ruleCode}</h1>
        {rule?.purpose && <span className="meta">{rule.purpose}</span>}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="toolbar">
        <input
          type="search"
          placeholder="Bill number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 200 }}
          aria-label="Search by bill number"
        />
        {ruleCode === "R09_OVER_30_DAY_INVOICE" && (
          <label className="note" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Overdue
            <input type="number" placeholder="Min" value={minOverdue}
                   onChange={(e) => setMinOverdue(e.target.value)} style={{ width: 70 }} />
            <span>–</span>
            <input type="number" placeholder="Max" value={maxOverdue}
                   onChange={(e) => setMaxOverdue(e.target.value)} style={{ width: 70 }} />
          </label>
        )}
        <button type="button" className="ghost" onClick={() => setShowExceptions((s) => !s)}>
          Excluded ({exceptions.length})
        </button>
        <span className="spacer" />
        {data && (
          <span className="note toolbar-summary">
            {count(data.total)} flags · {money(data.exposure)} at risk
          </span>
        )}
        <button type="button" className="ghost print-btn" onClick={() => window.print()} title="Print or save as PDF">
          <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M5.5 7.5V3.5h9v4" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="3" y="7.5" width="14" height="6.5" rx="1.2" />
            <path d="M5.5 12.5v4h9v-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Print
        </button>
        <a
          className="export-btn"
          href={api.csvUrl({
            rule_code: ruleCode,
            ...(search ? { search } : {}),
            ...(outletFilter ? { customer_search: outletFilter } : {}),
            ...(salesmanFilter ? { salesman_search: salesmanFilter } : {}),
            ...(sortBy ? { sort_by: sortBy, sort_dir: sortDir } : {}),
          }, locationId)}
        >
          Export to Excel (CSV)
        </a>
      </div>

      {showExceptions && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h2 style={{ marginBottom: 10 }}>Excluded from this list</h2>
          {exceptions.length === 0 && <div className="empty">No salesmen currently excluded from this rule.</div>}
          {exceptions.map((e) => (
            <div key={e.exception_id} className="toolbar" style={{ padding: "6px 0" }}>
              <span>{e.salesman_name ?? e.customer_name ?? "—"}</span>
              <span className="note">{e.note}</span>
              <span className="spacer" />
              <button className="ghost" onClick={() => removeException(e.exception_id)}>Remove</button>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-scroll violations-scroll" onScroll={handleScroll}>
          <table className="violations-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort("customer_name")}>
                  <div className="th-sort-label">Outlet{sortIndicator("customer_name")}</div>
                  <input
                    type="text"
                    placeholder="Filter outlet…"
                    value={outletFilter}
                    onChange={(e) => setOutletFilter(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="th-filter-input"
                  />
                </th>
                <th className="sortable" onClick={() => toggleSort("salesman_name")}>
                  <div className="th-sort-label">Salesman{sortIndicator("salesman_name")}</div>
                  <input
                    type="text"
                    placeholder="Filter salesman…"
                    value={salesmanFilter}
                    onChange={(e) => setSalesmanFilter(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="th-filter-input"
                  />
                </th>
                <th className="sortable" onClick={() => toggleSort("document_no")}>
                  Bill{" "}{sortIndicator("document_no")}
                </th>
                <th className="num amount-col sortable" onClick={() => toggleSort("amount")}>
                  Amount{" "}{sortIndicator("amount")}
                </th>
                <th className="num balance-col sortable" onClick={() => toggleSort("balance")}>
                  Balance{" "}{sortIndicator("balance")}
                </th>
                <th className="num overdue-col sortable" onClick={() => toggleSort("overdue_days")}>
                  Overdue{" "}{sortIndicator("overdue_days")}
                </th>
                <th className="sortable" onClick={() => toggleSort("reason")}>
                  Why it is flagged{sortIndicator("reason")}
                </th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((r) => (
                <tr key={r.violation_id} className="row-click" tabIndex={0}
                    onClick={() => setOpenCustomer(r.customer_code)}
                    onDoubleClick={(e) => { e.stopPropagation(); excludeSalesman(r.salesman_key, r.salesman_name); }}
                    onKeyDown={(e) => e.key === "Enter" && setOpenCustomer(r.customer_code)}
                    title="Double-click to exclude this salesman from this rule">
                  <td>
                    {r.customer_name}
                    <div className="note">{r.customer_code} · {r.channel_type}</div>
                  </td>
                  <td>
                    {r.salesman_name ?? "—"}
                    <div className="note">{r.beat ?? ""}</div>
                  </td>
                  <td>
                    {r.document_no ?? "—"}
                    <div className="note">{r.document_date ?? ""}</div>
                  </td>
                  <td className="num amount-col">{money(r.amount)}</td>
                  <td className="num balance-col">{money(r.balance)}</td>
                  <td className="num overdue-col">{r.overdue_days ?? "—"}</td>
                  <td>{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && allRows.length === 0 && (
          <div className="empty">Nothing flagged here. Either the Outlets are clean or the threshold needs a look in Rule settings.</div>
        )}
      </div>

      {data && data.total > 0 && (
        <div className="toolbar" style={{ marginTop: 12, justifyContent: "center" }}>
          {loadingMore ? (
            <span className="note">Loading more…</span>
          ) : (
            <span className="note">
              Showing {count(allRows.length)} of {count(data.total)} flags
              {allRows.length < data.total && " · scroll for more"}
            </span>
          )}
        </div>
      )}

      {openCustomer && (
        <CustomerDrawer customerCode={openCustomer} onClose={() => setOpenCustomer(null)} />
      )}
    </>
  );
}
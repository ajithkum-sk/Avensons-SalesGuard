import React, { useEffect, useState } from "react";
import { count, money } from "../../api.js";
import { salespersonApi } from "../../api/salespersonApi.js";
import StatusPill from "./StatusPill.jsx";

const PAGE = 100;

export default function MyShops({ flag, onOpenShop }) {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(flag ?? "all");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => setStatusFilter(flag ?? "all"), [flag]);

  useEffect(() => {
    const params = { limit: PAGE, offset };
    if (search.trim()) params.search = search.trim();
    if (statusFilter !== "all") params.status = statusFilter;
    const timer = setTimeout(() => {
      salespersonApi.shops(params).then(setData).catch((e) => setError(e.message));
    }, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [search, statusFilter, offset]);

  useEffect(() => setOffset(0), [search, statusFilter]);

  return (
    <>
      <div className="topbar">
        <h1>Shop Outstandings</h1>
        <span className="meta">My Outstanding Shops{data?.total_due != null ? ` · Total Due: ${money(data.total_due)}` : ""}</span>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="toolbar">
        <input type="search" placeholder="Search shop name" value={search}
               onChange={(e) => setSearch(e.target.value)} style={{ width: 260 }} aria-label="Search shops" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="high_due">High Due</option>
          <option value="colleague">Colleague Visited</option>
          <option value="avg30">Over 30-day average</option>
        </select>
        <span className="spacer" />
        {data && <span className="note">{count(data.total)} shops</span>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Shop Name</th><th className="num">Outstanding</th><th className="num">Due Days</th><th>Status</th></tr></thead>
            <tbody>
              {data?.rows.map((s) => (
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
        {data && data.rows.length === 0 && <div className="empty">No shops match that filter.</div>}
      </div>

      {data && data.total > PAGE && (
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button className="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</button>
          <span className="note">{offset + 1}–{Math.min(offset + PAGE, data.total)} of {count(data.total)}</span>
          <button className="ghost" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Next</button>
        </div>
      )}
    </>
  );
}
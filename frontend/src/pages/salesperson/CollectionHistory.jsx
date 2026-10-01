import React, { useEffect, useState } from "react";
import { count, money } from "../../api.js";
import { salespersonApi } from "../../api/salespersonApi.js";

const PAGE = 100;

export default function CollectionHistory() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [range, setRange] = useState("this_month");
  const [mode, setMode] = useState("all");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const params = { limit: PAGE, offset, range };
    if (mode !== "all") params.mode = mode;
    salespersonApi.collectionHistory(params).then(setData).catch((e) => setError(e.message));
  }, [range, mode, offset]);

  useEffect(() => setOffset(0), [range, mode]);

  return (
    <>
      <div className="topbar">
        <h1>Collection History</h1>
        <span className="meta">My Collection History{data?.total_collected != null ? ` · This period: ${money(data.total_collected)}` : ""}</span>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="toolbar">
        <select value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="this_month">This Month</option><option value="last_month">Last Month</option><option value="all">All Time</option>
        </select>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="all">All Payment Modes</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="cheque">Cheque</option>
        </select>
        <span className="spacer" />
        {data && <span className="note">{count(data.total)} collections</span>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Date</th><th>Outlet Name</th><th className="num">Amount</th><th>Mode</th></tr></thead>
            <tbody>
              {data?.rows.map((r) => (
                <tr key={r.collection_id}>
                  <td>{r.collected_on}</td><td>{r.customer_name}</td>
                  <td className="num">{money(r.amount)}</td>
                  <td style={{ textTransform: "capitalize" }}>{r.payment_mode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.rows.length === 0 && <div className="empty">No collections in this period.</div>}
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
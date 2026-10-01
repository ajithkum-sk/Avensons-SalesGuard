import React, { useEffect, useState } from "react";
import { salespersonApi } from "../../api/salespersonApi.js";

export default function Notifications() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [range, setRange] = useState("this_month");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = () => {
    const params = { range };
    if (unreadOnly) params.unread = "1";
    salespersonApi.notifications(params).then((d) => setRows(d.rows)).catch((e) => setError(e.message));
  };

  useEffect(load, [range, unreadOnly]);

  const markRead = async (id) => {
    try { await salespersonApi.markNotificationRead(id); load(); }
    catch (err) { setError(err.message); }
  };

  return (
    <>
      <div className="topbar"><h1>Notifications</h1><span className="meta">Notification from Manager</span></div>

      {error && <div className="error">{error}</div>}

      <div className="toolbar">
        <select value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="this_month">This Month</option><option value="all">All Time</option>
        </select>
        <label className="field-inline checkbox-label">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
          <span>Unread only</span>
        </label>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(rows ?? []).map((n) => (
          <div key={n.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="pill" style={{ color: n.read ? "var(--ink-soft)" : "var(--danger)" }}>{n.read ? "READ" : "NEW"}</span>
              <strong>{n.title}</strong>
            </div>
            <p style={{ margin: 0 }}>{n.body}</p>
            <div className="toolbar">
              <span className="note">{n.time_ago}</span>
              <span className="spacer" />
              {!n.read && <button className="ghost" onClick={() => markRead(n.id)}>Mark as Read</button>}
              {n.link && <button className="primary" onClick={() => markRead(n.id)}>View</button>}
            </div>
          </div>
        ))}
        {rows && rows.length === 0 && <div className="empty">No notifications yet.</div>}
      </div>
    </>
  );
}
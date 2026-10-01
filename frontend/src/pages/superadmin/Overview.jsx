import React, { useEffect, useState } from "react";
import { count } from "../../api.js";
import { adminApi } from "../../api/adminApi.js";

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminApi.overview().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="empty">Loading…</div>;

  return (
    <>
      <div className="topbar"><h1>System Overview</h1></div>
      <div className="grid k4">
        <div className="card stat"><div className="label">Total Users</div><div className="value">{count(data.total_users)}</div></div>
        <div className="card stat"><div className="label">Managers</div><div className="value">{count(data.managers)}</div></div>
        <div className="card stat"><div className="label">Salespeople</div><div className="value">{count(data.salespeople)}</div></div>
        <div className="card stat risk"><div className="label">Deactivated</div><div className="value">{count(data.deactivated)}</div></div>
      </div>
    </>
  );
}
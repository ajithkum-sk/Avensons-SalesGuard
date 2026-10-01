import React, { useEffect, useState } from "react";
import { salespersonApi } from "../../api/salespersonApi.js";

export default function Profile({ onLogout }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    salespersonApi.profile().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="empty">Loading profile…</div>;

  return (
    <>
      <div className="topbar"><h1>My Profile</h1></div>

      <div className="card" style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 18 }}>
        <div style={{ width: 96, height: 96, borderRadius: "var(--radius)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {data.photo_url
            ? <img src={data.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "var(--radius)" }} />
            : "Photo"}
        </div>
        <div>
          <h2>{data.name}</h2>
          <p className="note">{data.role_label ?? "Salesperson"}</p>
          <p className="note">{data.location}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 10 }}>Personal Information</h3>
        <dl className="kv">
          <dt>Phone</dt><dd>{data.phone ?? "—"}</dd>
          <dt>Employee ID</dt><dd>{data.employee_id ?? "—"}</dd>
          <dt>Joining Date</dt><dd>{data.joining_date ?? "—"}</dd>
        </dl>
      </div>

      <button className="ghost" onClick={onLogout}>Logout</button>
    </>
  );
}
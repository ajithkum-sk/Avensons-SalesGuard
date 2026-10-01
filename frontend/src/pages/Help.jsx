import React from "react";

export default function Help() {
  return (
    <>
      <div className="topbar">
        <h1>Help</h1>
        <span className="meta">SalesGuard user manual — how to upload, read alerts, and configure rules.</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 16px", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
          <a className="btn" href="/user-manual.pdf" download>
            Download PDF
          </a>
        </div>
        <iframe
          src="/user-manual.pdf"
          title="SalesGuard User Manual"
          style={{ width: "100%", height: "80vh", border: "none" }}
        />
      </div>
    </>
  );
}

import React from "react";

const COLOR_MAP = {
  "High Due": "var(--danger)",
  "Colleague": "#6b46c1",
  ">30 Avg": "var(--ok)",
};

export default function StatusPill({ status }) {
  if (!status) return "—";
  return <span className="pill" style={{ color: COLOR_MAP[status] ?? "var(--ink-soft)" }}>{status}</span>;
}
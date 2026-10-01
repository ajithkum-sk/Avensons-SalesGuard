import React, { useEffect, useRef, useState } from "react";
import { api, count } from "../api.js";
import RowMenu from "../components/RowMenu.jsx";

export default function Data({ onLoaded, onOpenRun, onShowSalesmen, onShowMonthlySalesmen }) {
  const [snapshots, setSnapshots] = useState([]);
  const [runs, setRuns] = useState([]);
  const [type, setType] = useState("daily");
  const [asOn, setAsOn] = useState("");
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const reload = () =>
    Promise.all([api.snapshots(), api.runs()])
      .then(([s, r]) => {
        setSnapshots(s);
        setRuns(r);
      })
      .catch((e) => setError(e.message));

  const reloadLocations = () =>
    api.locations()
      .then((rows) => {
        setLocations(rows);
        setLocationId((cur) => (cur && rows.some((r) => r.location_id === cur) ? cur : rows[0]?.location_id ?? ""));
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    reload();
    reloadLocations();
  }, []);

  const addLocation = async () => {
    const name = newLocation.trim();
    if (!name) return;
    if (locations.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
      setError(`"${name}" is already in the list.`);
      return;
    }
    try {
      await api.addLocation(name);
      setNewLocation("");
      setError(null);
      await reloadLocations();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteLocation = async (loc) => {
    if (locations.length === 1) {
      setError("You need at least one location — add another before removing this one.");
      return;
    }
    if (!window.confirm(`Remove "${loc.name}" from the location list?`)) return;
    try {
      await api.deleteLocation(loc.location_id);
      setError(null);
      await reloadLocations();
    } catch (err) {
      setError(err.message);
    }
  };

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const snapshotDate = type === "monthly" && asOn ? `${asOn}-01` : asOn;
    try {
      const res = await api.upload(file, { snapshotType: type, snapshotDate, locationId });
      setResult(res);
      await reload();
      onLoaded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const runForSnapshot = (snapshotDate) => {
    const candidates = runs.filter((r) => r.snapshot_date === snapshotDate);
    const success = candidates.filter((r) => r.status === "success");
    const pool = success.length ? success : candidates;
    return pool.sort((a, b) => b.run_id - a.run_id)[0] ?? null;
  };

  const remove = async (snapshotId, snapshotDate) => {
    if (!window.confirm(`Delete the report loaded for ${snapshotDate}? This also removes its rule checks and cannot be undone.`)) {
      return;
    }
    setDeletingId(snapshotId);
    setError(null);
    try {
      await api.deleteSnapshot(snapshotId);
      await reload();
      onLoaded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const isMonthlyResult = result && result.item_rows != null;
  const dailySnapshots = snapshots.filter((s) => s.snapshot_type === "daily");
  const monthlySnapshots = snapshots.filter((s) => s.snapshot_type === "monthly");

  const renderReportsTable = (title, list) => (
    <div className="card">
      <h2 style={{ marginBottom: 10 }}>{title}</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>As on</th><th>File</th><th className="num">Documents</th><th aria-label="Actions" /></tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const run = runForSnapshot(s.snapshot_date);
              return (
                <tr key={s.snapshot_id}>
                  <td>{s.snapshot_date}</td>
                  <td className="note">{s.source_file}</td>
                  <td className="num">{count(s.documents)}</td>
                  <td className="delete-col">
                    <RowMenu
                      ariaLabel={`Actions for report loaded ${s.snapshot_date}`}
                      items={[
                        {
                          label: "Show",
                          disabled: s.snapshot_type !== "monthly" && !run,
                          title:
                            s.snapshot_type === "monthly"
                              ? undefined
                              : run
                              ? undefined
                              : "No rule check has run for this report yet",
                          onClick: () => {
                            if (s.snapshot_type === "monthly") {
                              onShowMonthlySalesmen?.(s.snapshot_date.slice(0, 7) + "-01");
                            } else if (run) {
                              onShowSalesmen?.(run.run_id);
                            }
                          },
                        },
                        {
                          label: deletingId === s.snapshot_id ? "Deleting…" : "Delete",
                          danger: true,
                          disabled: deletingId === s.snapshot_id,
                          onClick: () => remove(s.snapshot_id, s.snapshot_date),
                        },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <div className="empty">Nothing loaded yet.</div>}
    </div>
  );

  return (
    <>
      <div className="topbar">
        <h1>Uploads</h1>
        <span className="meta">
          Drop the outstanding report here each evening. Loading the same date twice replaces it.
        </span>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginBottom: 10 }}>Load a report</h2>
        <div className="toolbar">
          <input type="file" ref={fileRef} accept=".xlsx,.xls,.xlsm" aria-label="Excel file" />
          <select value={locationId} onChange={(e) => setLocationId(Number(e.target.value))} aria-label="Location">
            {locations.map((loc) => (
              <option key={loc.location_id} value={loc.location_id}>{loc.name}</option>
            ))}
          </select>
          <select value={type} onChange={(e) => { setType(e.target.value); setAsOn(""); }} aria-label="Report type">
            <option value="daily">Daily outstanding</option>
            <option value="monthly">Monthly sales</option>
          </select>
          <label className="note">
            As on{" "}
            {type === "monthly" ? (
              <input type="month" value={asOn} onChange={(e) => setAsOn(e.target.value)} />
            ) : (
              <input type="date" value={asOn} onChange={(e) => setAsOn(e.target.value)} />
            )}
          </label>
          <button className="primary" onClick={upload} disabled={busy}>
            {busy ? "Loading and checking…" : "Load and check"}
          </button>
        </div>

        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", color: "var(--accent)", fontWeight: 600 }}>
            Manage locations
          </summary>
          <div className="toolbar" style={{ marginTop: 10 }}>
            <input
              type="text"
              placeholder="New location name"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLocation()}
              style={{ width: 220 }}
            />
            <button className="ghost" onClick={addLocation}>Add</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {locations.map((loc) => (
              <span key={loc.location_id} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                border: "1px solid var(--line)", borderRadius: "var(--radius)",
                padding: "4px 10px", fontSize: 13,
              }}>
                {loc.name}
                <button
                  onClick={() => deleteLocation(loc)}
                  title={`Remove ${loc.name}`}
                  aria-label={`Remove ${loc.name}`}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "var(--danger)", fontWeight: 700, lineHeight: 1 }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </details>

        {result && (
          <div className="banner">
            {isMonthlyResult ? (
              <>
                Loaded {count(result.item_rows)} sales line items for {result.snapshot_date} —{" "}
                {count(result.monthly_sales_rows)} customer-months, {count(result.new_customers)} new customers,{" "}
                {count(result.skipped_unmatched_salesman)} rows skipped (unmatched salesman).
              </>
            ) : (
              <>
                Loaded {count(result.documents)} documents for {result.snapshot_date} —{" "}
                {count(result.customers)} outlets, {count(result.salesmen)} salesmen.{" "}
                {result.run
                  ? `${count(result.run.rules.reduce((a, r) => a + r.hits, 0))} flags raised across ${result.run.rules.length} rules.`
                  : ""}
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid k2">
        {renderReportsTable("Daily Reports", dailySnapshots)}
        {renderReportsTable("Monthly Reports", monthlySnapshots)}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2 style={{ marginBottom: 10 }}>Rule checks</h2>
        <table>
          <thead>
            <tr><th>Run</th><th>As on</th><th>Status</th><th className="num">In scope</th><th className="num">Flags</th></tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr
                key={r.run_id}
                className={r.status === "success" ? "row-click" : ""}
                tabIndex={r.status === "success" ? 0 : undefined}
                onClick={() => r.status === "success" && onOpenRun?.(r.run_id)}
                onKeyDown={(e) => r.status === "success" && e.key === "Enter" && onOpenRun?.(r.run_id)}
              >
                <td>#{r.run_id}</td>
                <td>{r.snapshot_date}</td>
                <td>{r.status}</td>
                <td className="num">{count(r.scope_rows)}</td>
                <td className="num">{count(r.violations)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {runs.length === 0 && <div className="empty">No checks run yet.</div>}
      </div>
    </>
  );
}
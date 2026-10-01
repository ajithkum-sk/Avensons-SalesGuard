import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { money } from "../../api.js";
import { salespersonApi } from "../../api/salespersonApi.js";
import StatusPill from "./StatusPill.jsx";

export default function ShopDetails({ customerCode, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [mode, setMode] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [explainFor, setExplainFor] = useState(null);
  const [explainText, setExplainText] = useState("");

  useEffect(() => {
    if (!customerCode) return;
    salespersonApi.shopDetail(customerCode).then(setData).catch((e) => setError(e.message));
  }, [customerCode]);

  if (!customerCode) {
    return <div className="card"><p className="note">Open a shop from My Shops or the Dashboard to see its documents here.</p></div>;
  }
  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="empty">Loading shop…</div>;

  const toggle = (docId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(docId) ? next.delete(docId) : next.add(docId);
      return next;
    });
  };

  const selectedAmount = data.documents
    .filter((d) => selected.has(d.document_id))
    .reduce((sum, d) => sum + Number(d.balance || 0), 0);

  const markCollected = async () => {
    if (selected.size === 0) return toast.error("Select at least one document");
    setBusy(true);
    try {
      await salespersonApi.markCollected({
        customer_code: customerCode,
        document_ids: [...selected],
        amount: selectedAmount,
        payment_mode: mode,
      });
      toast.success("Marked as collected");
      setSelected(new Set());
      setData(await salespersonApi.shopDetail(customerCode));
    } catch (err) {
      toast.error(err.message || "Could not mark as collected");
    } finally {
      setBusy(false);
    }
  };

  const submitExplanation = async (violationId) => {
    if (!explainText.trim()) return;
    try {
      await salespersonApi.addExplanation(violationId, { note: explainText.trim() });
      toast.success("Explanation added");
      setExplainFor(null);
      setExplainText("");
      setData(await salespersonApi.shopDetail(customerCode));
    } catch (err) {
      toast.error(err.message || "Could not save explanation");
    }
  };

  return (
    <>
      <button className="back-link" onClick={onBack}><span className="back-arrow">&#8592;</span> Back to My Shops</button>

      <div className="topbar">
        <h1>{data.customer.customer_name}</h1>
        <span className="meta">Total Outstanding: {money(data.customer.total_outstanding)}</span>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 16 }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th style={{ width: 30 }}></th><th>Document No</th><th className="num">Amount</th><th className="num">Due Days</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {data.documents.map((d) => (
                <React.Fragment key={d.document_id}>
                  <tr>
                    <td><input type="checkbox" checked={selected.has(d.document_id)} onChange={() => toggle(d.document_id)} aria-label={`Select ${d.document_no}`} /></td>
                    <td>{d.document_no}</td>
                    <td className="num">{money(d.balance)}</td>
                    <td className="num">{d.due_days ?? "—"}</td>
                    <td><StatusPill status={d.status} /></td>
                    <td>
                      {d.violation_id && (
                        <button className="linkbtn" onClick={() => { setExplainFor(d.violation_id); setExplainText(d.explanation ?? ""); }}>
                          {d.explanation ? "Edit explanation" : "Explain"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {explainFor === d.violation_id && (
                    <tr>
                      <td colSpan={6}>
                        <div className="toolbar">
                          <input value={explainText} onChange={(e) => setExplainText(e.target.value)}
                                 placeholder="Why is this flagged? (visible to your manager)" style={{ flex: 1 }} />
                          <button className="primary" onClick={() => submitExplanation(d.violation_id)}>Save</button>
                          <button className="ghost" onClick={() => setExplainFor(null)}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {data.documents.length === 0 && <div className="empty">No open documents for this shop.</div>}
      </div>

      <div className="card">
        <div className="toolbar">
          <strong>Selected Amount: {money(selectedAmount)}</strong>
          <span className="spacer" />
          <label className="field-inline">
            <span>Payment Mode</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="cash">Cash</option><option value="upi">UPI</option><option value="cheque">Cheque</option>
            </select>
          </label>
        </div>
        <div className="toolbar" style={{ justifyContent: "flex-end" }}>
          <button className="ghost" onClick={() => setSelected(new Set())}>Cancel</button>
          <button className="primary" onClick={markCollected} disabled={busy || selected.size === 0}>
            {busy ? "Saving…" : "Mark as Collected"}
          </button>
        </div>
      </div>
    </>
  );
}
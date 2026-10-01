import React, { useState } from "react";
import toast from "react-hot-toast";
import { adminApi } from "../../api/adminApi.js";

const fieldLabel = { display: "flex", flexDirection: "column", gap: 4, marginBottom: 12, fontSize: 13 };
const fieldSpan = { color: "var(--ink-soft)" };

export default function UserFormModal({ user, onClose, onSaved }) {
  const isEdit = Boolean(user);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState(user?.role ?? "salesperson");
  const [employeeId, setEmployeeId] = useState(user?.employee_id ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isEdit) {
        await adminApi.updateUser(user.user_id, { name, email, role, employee_id: employeeId, phone });
        toast.success("User updated");
      } else {
        const res = await adminApi.createUser({ name, email, role, employee_id: employeeId, phone });
        toast.success(
          res.temp_password ? `User created — temporary password: ${res.temp_password}` : "User created",
          { duration: 10000 }
        );
      }
      onSaved();
    } catch (err) {
      toast.error(err.message || "Could not save this user");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}
    >
      <form className="card" style={{ width: 420, maxWidth: "92vw" }} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 style={{ marginBottom: 14 }}>{isEdit ? "Edit User" : "Add User"}</h2>

        <label style={fieldLabel}>
          <span style={fieldSpan}>Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={fieldLabel}>
          <span style={fieldSpan}>Email</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEdit} />
        </label>
        <label style={fieldLabel}>
          <span style={fieldSpan}>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="superadmin">Super Admin</option>
            <option value="manager">Manager</option>
            <option value="salesperson">Salesperson</option>
          </select>
        </label>
        <label style={fieldLabel}>
          <span style={fieldSpan}>Employee ID (optional)</span>
          <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
        </label>
        <label style={fieldLabel}>
          <span style={fieldSpan}>Phone (optional)</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>

        <div className="toolbar" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save Changes" : "Create User"}
          </button>
        </div>
      </form>
    </div>
  );
}
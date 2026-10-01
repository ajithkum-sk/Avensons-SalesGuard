import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { count } from "../../api.js";
import { adminApi } from "../../api/adminApi.js";
import RowMenu from "../../components/RowMenu.jsx";
import UserFormModal from "./UserFormModal.jsx";

const PAGE = 100;

const ROLE_STYLE = {
  superadmin: { color: "var(--danger)", bg: "rgba(161,45,45,0.10)", label: "Super Admin" },
  manager: { color: "var(--accent)", bg: "rgba(15,107,99,0.10)", label: "Manager" },
  salesperson: { color: "var(--ink-soft)", bg: "rgba(90,107,124,0.10)", label: "Salesperson" },
};

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Users() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [offset, setOffset] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const load = () => {
    const params = { limit: PAGE, offset };
    if (search.trim()) params.search = search.trim();
    if (roleFilter !== "all") params.role = roleFilter;
    adminApi.users(params).then(setData).catch((e) => setError(e.message));
  };

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [search, roleFilter, offset]);

  useEffect(() => setOffset(0), [search, roleFilter]);

  const toggleActive = async (u) => {
    const activating = !u.active;
    if (!window.confirm(`${activating ? "Reactivate" : "Deactivate"} ${u.name}'s account?`)) return;
    try {
      await adminApi.setUserActive(u.user_id, activating);
      toast.success(`${u.name} ${activating ? "reactivated" : "deactivated"}`);
      load();
    } catch (err) {
      toast.error(err.message || "Could not update this account");
    }
  };

  const resetPassword = async (u) => {
    if (!window.confirm(`Reset ${u.name}'s password? A new temporary password will be generated.`)) return;
    try {
      const res = await adminApi.resetUserPassword(u.user_id);
      toast.success(`New temporary password: ${res.temp_password}`, { duration: 10000 });
    } catch (err) {
      toast.error(err.message || "Could not reset password");
    }
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE));
  const currentPage = Math.floor(offset / PAGE) + 1;
  const goToPage = (p) => setOffset((p - 1) * PAGE);
  const pageWindow = () => {
    const end = Math.min(totalPages, Math.max(6, currentPage + 2));
    const start = Math.max(1, end - 5);
    const pages = [];
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  };

  return (
    <>
      <div className="topbar">
        <h1>User Management</h1>
        <span className="meta">Add, manage, and monitor user access and roles</span>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="toolbar">
        <div style={{ position: "relative" }}>
          <svg
            viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8"
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-soft)", pointerEvents: "none" }}
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="M17 17l-4-4" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240, paddingLeft: 30 }}
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="superadmin">Super Admin</option>
          <option value="manager">Manager</option>
          <option value="salesperson">Salesperson</option>
        </select>
        <span className="spacer" />
        <button className="primary" onClick={() => { setEditingUser(null); setFormOpen(true); }}>
          + Add User
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {data?.rows.map((u) => {
                const roleStyle = ROLE_STYLE[u.role] ?? ROLE_STYLE.salesperson;
                return (
                  <tr key={u.user_id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          className="user-avatar"
                          style={{ width: 34, height: 34, fontSize: 13, flexShrink: 0 }}
                        >
                          {initials(u.name)}
                        </span>
                        <strong>{u.name}</strong>
                      </div>
                    </td>
                    <td className="note">{u.email}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-block", padding: "3px 10px", borderRadius: 999,
                          fontSize: 11, fontWeight: 700, color: roleStyle.color, background: roleStyle.bg,
                        }}
                      >
                        {roleStyle.label}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: u.active ? "var(--ok)" : "var(--ink-soft)" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: u.active ? "var(--ok)" : "var(--ink-soft)" }} />
                        {u.active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="delete-col">
                      <RowMenu
                        ariaLabel={`Actions for ${u.name}`}
                        items={[
                          { label: "Edit", onClick: () => { setEditingUser(u); setFormOpen(true); } },
                          { label: "Reset password", onClick: () => resetPassword(u) },
                          {
                            label: u.active ? "Deactivate" : "Reactivate",
                            danger: u.active,
                            onClick: () => toggleActive(u),
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
        {data && data.rows.length === 0 && <div className="empty">No users match that search.</div>}
      </div>

      {data && total > 0 && (
        <div className="toolbar" style={{ marginTop: 12, justifyContent: "space-between" }}>
          <span className="note">
            Showing {offset + 1} to {Math.min(offset + PAGE, total)} of {count(total)} users
          </span>
          <div className="toolbar" style={{ gap: 6 }}>
            <button className="ghost" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>
              Previous
            </button>
            {pageWindow().map((p) => (
              <button
                key={p}
                className="ghost"
                style={p === currentPage ? { borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 700 } : undefined}
                onClick={() => goToPage(p)}
              >
                {p}
              </button>
            ))}
            <button className="ghost" disabled={currentPage === totalPages} onClick={() => goToPage(currentPage + 1)}>
              Next
            </button>
          </div>
        </div>
      )}

      {formOpen && (
        <UserFormModal
          user={editingUser}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load(); }}
        />
      )}
    </>
  );
}
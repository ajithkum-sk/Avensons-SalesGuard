import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function UserMenu() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/");
  };

  const name = auth?.user?.name ?? "Account";
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-menu-trigger" onClick={() => setOpen((o) => !o)} aria-label="Account menu">
        <span className="user-avatar">{initial}</span>
        <span className="user-menu-name">{name}</span>
      </button>
      {open && (
        <div className="user-menu-panel">
          <div className="user-menu-header">
            <div className="user-menu-fullname">{name}</div>
            {auth?.user?.role && <div className="user-menu-role">{auth.user.role}</div>}
          </div>
          <button className="user-menu-item danger" onClick={handleLogout}>Logout</button>
        </div>
      )}
    </div>
  );
}
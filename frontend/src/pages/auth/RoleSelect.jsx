import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROLES } from "../../constants/roles.js";
import avensonsLogo from "../../assets/avensons_sales.png";

export default function RoleSelect() {
  const [role, setRole] = useState("");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-full max-w-md border border-line rounded bg-card p-10 flex flex-col items-center gap-8">
        <img src={avensonsLogo} alt="Avensons Ventures" className="h-20" />
        <div className="w-full flex flex-col gap-4">
          <div className="relative">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={`w-full appearance-none rounded border border-line bg-surface px-4 py-3 pr-10 font-semibold focus:outline-none focus:ring-2 focus:ring-accent ${
                role ? "text-ink" : "text-ink-soft"
              }`}
            >
              <option value="">Choose role...</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <button
            disabled={!role}
            onClick={() => navigate("/login", { state: { role } })}
            className="w-full rounded bg-accent text-white font-semibold py-3 hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
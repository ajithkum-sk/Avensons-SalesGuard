import { useState } from "react";
import { useLocation, useNavigate, Link, Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authApi } from "../../api/authApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROLE_HOME } from "../../constants/roles.js";
import avensonsLogo from "../../assets/avensons_sales.png";

export default function Login() {
  const { state } = useLocation();
  const role = state?.role;
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!role) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await authApi.login(email, password, role);
      login(data);
      toast.success(`Welcome back, ${data.user.name}`);
      navigate(ROLE_HOME[data.user.role] ?? "/");
    } catch (err) {
      toast.error(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <form
        onSubmit={submit}
        className="w-full max-w-sm border border-line rounded bg-card p-10 flex flex-col items-center gap-5"
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            alignSelf: "flex-start",
            background: "none",
            border: "none",
            color: "var(--accent)",
            cursor: "pointer",
            fontSize: 13,
            padding: 0,
            marginBottom: -8,
          }}
        >
          ← Back
        </button>

        <img src={avensonsLogo} alt="Avensons Ventures" className="h-16" />

        <input
          type="email" required placeholder="Enter Registered email ID"
          value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-line px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          type="password" required placeholder="Enter Password"
          value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-line px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button type="submit" disabled={busy}
          className="w-full rounded bg-accent text-white font-semibold py-3 hover:opacity-90 transition disabled:opacity-50">
          {busy ? "Logging in…" : "Log In"}
        </button>
        <Link to="/forgot-password" state={{ role }} className="text-sm text-accent hover:underline">
          Forgot Password?
        </Link>
      </form>
    </div>
  );
}
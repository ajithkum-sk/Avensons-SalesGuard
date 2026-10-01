import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { authApi } from "../../api/authApi.js";
import avensonsLogo from "../../assets/avensons_sales.png";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pw !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      await authApi.resetPassword(token, pw);
      toast.success("Password updated — please log in");
      navigate("/login");
    } catch (err) {
      toast.error(err.message || "Could not reset password");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-full max-w-sm border border-line rounded bg-card p-10 text-center">
          <p className="text-ink-soft mb-3">This reset link is invalid or has expired.</p>
          <Link to="/forgot-password" className="text-accent hover:underline text-sm">Request a new one</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <form onSubmit={submit} className="w-full max-w-sm border border-line rounded bg-card p-10 flex flex-col items-center gap-5">
        <img src={avensonsLogo} alt="Avensons Ventures" className="h-16" />
        <input type="password" required placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)}
          className="w-full rounded border border-line px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-accent" />
        <input type="password" required placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded border border-line px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-accent" />
        <button type="submit" disabled={busy}
          className="w-full rounded bg-accent text-white font-semibold py-3 hover:opacity-90 transition disabled:opacity-50">
          {busy ? "Saving…" : "Reset Password"}
        </button>
      </form>
    </div>
  );
}
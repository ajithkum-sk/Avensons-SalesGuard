import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { authApi } from "../../api/authApi.js";
import avensonsLogo from "../../assets/avensons_sales.png";

export default function ForgotPassword() {
  const { state } = useLocation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      toast.error(err.message || "Could not send reset link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-full max-w-sm border border-line rounded bg-card p-10 flex flex-col items-center gap-5">
        <img src={avensonsLogo} alt="Avensons Ventures" className="h-16" />
        {sent ? (
          <>
            <p className="text-ink-soft text-center text-sm">
              If an account exists for <strong>{email}</strong>, a reset link has been sent.
            </p>
            <Link to="/login" state={state} className="text-sm text-accent hover:underline">Back to Log In</Link>
          </>
        ) : (
          <form onSubmit={submit} className="w-full flex flex-col gap-5 items-center">
            <input
              type="email" required placeholder="Enter Registered email ID"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-line px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button type="submit" disabled={busy}
              className="w-full rounded bg-accent text-white font-semibold py-3 hover:opacity-90 transition disabled:opacity-50">
              {busy ? "Sending…" : "Send Reset Link"}
            </button>
            <Link to="/login" state={state} className="text-sm text-accent hover:underline">Back to Log In</Link>
          </form>
        )}
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-browser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Supabase sets the session from the URL hash (#access_token=...) on page load
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!password) { setError("Please enter a new password."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push("/dashboard"), 2000);
  };

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="fixed inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, rgba(124,197,168,0.8) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="text-center relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-bf-accent to-emerald-600 inline-flex items-center justify-center text-2xl font-extrabold text-bf-bg mb-4">B</div>
          <div className="text-bf-dim text-sm mt-4">Verifying reset link...</div>
          <p className="text-xs text-bf-dim mt-2 max-w-[280px]">
            If this takes too long, your link may have expired. <button onClick={() => router.push("/forgot-password")} className="text-bf-accent bg-transparent border-none cursor-pointer">Request a new one →</button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="fixed inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, rgba(124,197,168,0.8) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="w-full max-w-[400px] animate-fade-up relative z-10">
        <div className="text-center mb-9">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-bf-accent to-emerald-600 inline-flex items-center justify-center text-2xl font-extrabold text-bf-bg mb-4">B</div>
          <h1 className="text-3xl font-bold tracking-tight">
            budget<span className="text-bf-accent">flow</span>
          </h1>
          <p className="text-sm text-bf-dim mt-2">Set a new password.</p>
        </div>

        {success ? (
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-lg font-semibold mb-2">Password updated!</h2>
            <p className="text-sm text-bf-dim">Redirecting you to the dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] text-bf-dim tracking-widest uppercase font-mono block mb-1">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition"
              />
            </div>
            <div>
              <label className="text-[11px] text-bf-dim tracking-widest uppercase font-mono block mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition"
              />
            </div>

            {error && (
              <div className="text-sm text-bf-accent2 px-3 py-2 bg-bf-accent2/[0.08] rounded-lg border border-bf-accent2/[0.15]">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-[15px] font-bold cursor-pointer disabled:opacity-50 mt-1 transition hover:opacity-90"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

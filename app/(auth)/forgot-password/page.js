"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email) { setError("Please enter your email."); return; }
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="fixed inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, rgba(124,197,168,0.8) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="w-full max-w-[400px] animate-fade-up relative z-10">
        <div className="text-center mb-9">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-bf-accent to-emerald-600 inline-flex items-center justify-center text-2xl font-extrabold text-bf-bg mb-4">B</div>
          <h1 className="text-3xl font-bold tracking-tight">
            budget<span className="text-bf-accent">flow</span>
          </h1>
          <p className="text-sm text-bf-dim mt-2">Reset your password.</p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="text-4xl mb-4">📬</div>
            <h2 className="text-lg font-semibold mb-2">Check your inbox</h2>
            <p className="text-sm text-bf-dim mb-6">
              We sent a password reset link to <span className="text-bf-text font-medium">{email}</span>. Check your email and follow the link.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="text-sm text-bf-accent font-semibold bg-transparent border-none cursor-pointer"
            >
              ← Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] text-bf-dim tracking-widest uppercase font-mono block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
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
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        {!sent && (
          <div className="text-center mt-5">
            <button onClick={() => router.push("/login")} className="text-sm text-bf-dim hover:text-bf-text bg-transparent border-none cursor-pointer transition">
              ← Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

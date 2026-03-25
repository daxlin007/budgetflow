"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-browser";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!name || !email || !password) { setError("Please fill in all fields."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setNotice("Account created. Check your email to confirm your account, then sign in.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="fixed inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, rgba(124,197,168,0.8) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="w-full max-w-[400px] animate-fade-up relative z-10">
        <div className="text-center mb-9">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-bf-accent to-emerald-600 inline-flex items-center justify-center text-2xl font-extrabold text-bf-bg mb-4 animate-float">B</div>
          <h1 className="text-3xl font-bold tracking-tight">
            budget<span className="text-bf-accent">flow</span>
          </h1>
          <p className="text-sm text-bf-dim mt-2">Create your account to get started.</p>
        </div>

        <form onSubmit={handleSignup} className="flex flex-col gap-3">
          <div>
            <label className="text-[11px] text-bf-dim tracking-widest uppercase font-mono block mb-1">Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="David"
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition" />
          </div>
          <div>
            <label className="text-[11px] text-bf-dim tracking-widest uppercase font-mono block mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com"
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition" />
          </div>
          <div>
            <label className="text-[11px] text-bf-dim tracking-widest uppercase font-mono block mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters"
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition" />
          </div>

          {error && (
            <div className="text-sm text-bf-accent2 px-3 py-2 bg-bf-accent2/[0.08] rounded-lg border border-bf-accent2/[0.15]">{error}</div>
          )}
          {notice && (
            <div className="text-sm text-bf-accent px-3 py-2 bg-bf-accent/[0.1] rounded-lg border border-bf-accent/[0.2]">{notice}</div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-[15px] font-bold cursor-pointer disabled:opacity-50 mt-1 transition hover:opacity-90">
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="text-center mt-5">
          <span className="text-sm text-bf-dim">Already have an account? </span>
          <button onClick={() => router.push("/login")} className="text-sm text-bf-accent font-semibold bg-transparent border-none cursor-pointer">
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

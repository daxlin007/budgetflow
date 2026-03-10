"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-browser";
import { updateProfile } from "../../lib/db";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    if (!name || !email || !password) { setError("Please fill in all fields."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);

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

    // Save location to profile so the AI can contextualise local stores/merchants
    if (country || city) {
      try {
        await updateProfile({ country: country.trim() || null, city: city.trim() || null });
      } catch (_) {
        // Non-fatal — profile can be updated later in Setup
      }
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
            <label className="text-[11px] text-bf-dim tracking-widests uppercase font-mono block mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com"
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition" />
          </div>
          <div>
            <label className="text-[11px] text-bf-dim tracking-widests uppercase font-mono block mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters"
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition" />
          </div>

          {/* Location — helps the AI recognise local stores & merchants */}
          <div className="flex gap-2.5 mt-0.5">
            <div className="flex-1">
              <label className="text-[11px] text-bf-dim tracking-widests uppercase font-mono block mb-1">Country</label>
              <input value={country} onChange={e => setCountry(e.target.value)} placeholder="Canada"
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition" />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-bf-dim tracking-widests uppercase font-mono block mb-1">City</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="Toronto"
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition" />
            </div>
          </div>
          <p className="text-[10px] text-bf-dim -mt-1 px-0.5">
            Optional — lets the AI recognise local store names automatically.
          </p>

          {error && (
            <div className="text-sm text-bf-accent2 px-3 py-2 bg-bf-accent2/[0.08] rounded-lg border border-bf-accent2/[0.15]">{error}</div>
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

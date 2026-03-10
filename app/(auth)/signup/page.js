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
  const [signupSuccess, setSignupSuccess] = useState(false);
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

    // Show success message
    setSignupSuccess(true);

    // After 2 seconds, redirect to email verification
    setTimeout(() => {
      router.push("/verify-email");
      router.refresh();
    }, 2000);
  };

  const handleGoogleSignup = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/verify-email` },
    });
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
          <p className="text-sm text-bf-dim mt-2">{signupSuccess ? "Verify your email to continue" : "Create your account to get started."}</p>
        </div>

        {signupSuccess ? (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-7 text-center">
            <div className="text-5xl mb-4 animate-pulse">✓</div>
            <h2 className="text-xl font-semibold mb-2">Account Created!</h2>
            <p className="text-sm text-bf-dim mb-6">
              A verification email has been sent to<br />
              <span className="font-mono text-bf-accent">{email}</span>
            </p>
            <p className="text-xs text-bf-dim mb-4">
              Redirecting to email verification...
            </p>
            <div className="w-8 h-8 border-2 border-bf-accent/20 border-t-bf-accent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
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

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-[15px] font-bold cursor-pointer disabled:opacity-50 mt-1 transition hover:opacity-90">
              {loading ? "Creating account..." : "Create Account"}
            </button>

            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-white/[0.07]" />
              <span className="text-[11px] text-bf-dim font-mono">or</span>
              <div className="flex-1 h-px bg-white/[0.07]" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignup}
              className="w-full py-3 rounded-xl bg-white/[0.04] border border-white/[0.07] text-bf-text text-[14px] font-medium cursor-pointer hover:bg-white/[0.07] transition flex items-center justify-center gap-2.5"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="text-center mt-5">
              <span className="text-sm text-bf-dim">Already have an account? </span>
              <button onClick={() => router.push("/login")} className="text-sm text-bf-accent font-semibold bg-transparent border-none cursor-pointer">
                Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

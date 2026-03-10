"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-browser";

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkVerification = async () => {
      setChecking(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        setEmail(user.email);

        // Check if email is verified
        if (user.email_confirmed_at) {
          setVerified(true);
          // Redirect to onboarding after a short delay
          setTimeout(() => router.push("/onboarding"), 1000);
        }
      } catch (e) {
        console.error(e);
        setError("Unable to check verification status.");
      } finally {
        setChecking(false);
      }
    };

    checkVerification();
    const interval = setInterval(checkVerification, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, [router, supabase]);

  const handleResendEmail = async () => {
    setError("");
    setChecking(true);
    try {
      const { error } = await supabase.auth.resendEnvelope("signup", {
        email,
      });

      if (error) {
        setError(error.message || "Failed to resend email.");
      } else {
        setError(""); // Clear any previous errors
      }
    } catch (e) {
      setError("Failed to resend verification email. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="fixed inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, rgba(124,197,168,0.8) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="w-full max-w-[400px] relative z-10">
        {verified ? (
          <div className="text-center">
            <div className="text-5xl mb-4 animate-pulse">✓</div>
            <h1 className="text-2xl font-bold mb-2">Email Verified!</h1>
            <p className="text-bf-dim mb-6">Redirecting you to setup...</p>
          </div>
        ) : (
          <div>
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-bf-accent to-emerald-600 inline-flex items-center justify-center text-2xl font-extrabold text-bf-bg mb-4">B</div>
              <h1 className="text-3xl font-bold tracking-tight">
                budget<span className="text-bf-accent">flow</span>
              </h1>
              <p className="text-sm text-bf-dim mt-2">Verify your email to continue</p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-7">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">📧</div>
                <h2 className="text-lg font-semibold mb-2">Check your inbox</h2>
                <p className="text-sm text-bf-dim mb-4">
                  We've sent a verification email to<br />
                  <span className="font-mono text-bf-accent">{email}</span>
                </p>
                <p className="text-xs text-bf-dim">
                  Click the link in the email to verify your account. We're automatically checking — you'll be redirected as soon as it's verified.
                </p>
              </div>

              {error && (
                <div className="text-sm text-bf-accent2 px-3 py-2 bg-bf-accent2/[0.08] rounded-lg border border-bf-accent2/[0.15] mb-4">
                  {error}
                </div>
              )}

              <button
                onClick={handleResendEmail}
                disabled={checking}
                className="w-full py-3 rounded-xl bg-white/[0.04] border border-white/[0.07] text-bf-text text-sm font-medium cursor-pointer hover:bg-white/[0.07] transition disabled:opacity-50 mb-3"
              >
                {checking ? "Checking..." : "Didn't get the email? Resend"}
              </button>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-px bg-white/[0.07]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-bf-bg text-bf-dim">or</span>
                </div>
              </div>

              <button
                onClick={() => router.push("/login")}
                className="w-full py-3 rounded-xl bg-white/[0.04] border border-white/[0.07] text-bf-text text-sm font-medium cursor-pointer hover:bg-white/[0.07] transition"
              >
                Go back to Sign In
              </button>
            </div>

            <p className="text-center text-xs text-bf-dim mt-4">
              Check your spam folder if you don't see the email
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

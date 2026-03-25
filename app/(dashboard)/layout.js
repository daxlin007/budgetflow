"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "../lib/supabase-browser";
import {
  getProfile,
  updateProfile,
  insertCategories,
  insertRecurringBatch,
} from "../lib/db";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "▣", href: "/dashboard" },
  { id: "budget", label: "Budget", icon: "◉", href: "/budget" },
  { id: "history", label: "History", icon: "☰", href: "/history" },
  { id: "setup", label: "Setup", icon: "⚙", href: "/setup" },
];

// Default categories from seed.sql reference
const DEFAULT_CATEGORIES = [
  { slug: "rent", name: "Rent / Mortgage", emoji: "🏠", budget: 1800, color: "#E8927C" },
  { slug: "groceries", name: "Groceries", emoji: "🥑", budget: 600, color: "#7CC5A8" },
  { slug: "gas", name: "Gas / Fuel", emoji: "⛽", budget: 200, color: "#7CAFC5" },
  { slug: "dining", name: "Dining Out", emoji: "🍽️", budget: 250, color: "#C57CA8" },
  { slug: "utilities", name: "Utilities", emoji: "💡", budget: 250, color: "#C5B87C" },
  { slug: "subscriptions", name: "Subscriptions", emoji: "📱", budget: 80, color: "#A87CC5" },
  { slug: "transport", name: "Transport", emoji: "🚌", budget: 150, color: "#7CC5C5" },
  { slug: "fun", name: "Personal / Fun", emoji: "🎯", budget: 200, color: "#C57C7C" },
];

// Default recurring expenses (description + category slug)
const DEFAULT_RECURRING = [
  { description: "Rent", amount: 1800, slug: "rent" },
  { description: "Phone Plan", amount: 75, slug: "utilities" },
  { description: "Netflix + Spotify", amount: 28.99, slug: "subscriptions" },
];

// ── Onboarding Wizard ────────────────────────────────────────────────────────
function OnboardingWizard({ profile, onComplete }) {
  const [step, setStep] = useState(0); // 0=welcome, 1=income, 2=categories, 3=done
  const [income, setIncome] = useState(
    String(profile?.monthly_income || "5500")
  );
  const [catBudgets, setCatBudgets] = useState(
    Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.slug, String(c.budget)]))
  );
  const [saving, setSaving] = useState(false);

  const firstName = (profile?.name || "there").split(" ")[0];

  const handleFinish = async () => {
    setSaving(true);
    try {
      // 1. Save income
      const incomeVal = parseFloat(income) || 5500;
      await updateProfile({ monthly_income: incomeVal });

      // 2. Insert default categories with user-specified budgets
      const catsToInsert = DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        budget: parseFloat(catBudgets[c.slug]) || c.budget,
      }));
      const insertedCats = await insertCategories(catsToInsert);

      // 3. Insert default recurring expenses, linking to inserted category ids
      const catBySlug = Object.fromEntries(
        insertedCats.map((c) => [c.slug, c])
      );
      const recsToInsert = DEFAULT_RECURRING.map((r) => ({
        description: r.description,
        amount: r.amount,
        category_id: catBySlug[r.slug]?.id || null,
      }));
      await insertRecurringBatch(recsToInsert);

      // 4. Mark onboarded
      await updateProfile({ onboarded: true });

      onComplete();
    } catch (e) {
      console.error("Onboarding error:", e);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
      <div className="bg-bf-surface border border-white/[0.1] rounded-2xl w-full max-w-[460px] overflow-hidden">
        {/* Progress bar */}
        <div className="h-0.5 bg-white/[0.07]">
          <div
            className="h-full bg-bf-accent transition-all duration-500"
            style={{ width: `${((step + 1) / 4) * 100}%` }}
          />
        </div>

        <div className="p-7">
          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-bf-accent to-emerald-600 inline-flex items-center justify-center text-3xl font-extrabold text-bf-bg mb-5 animate-float">
                B
              </div>
              <h2 className="text-2xl font-bold mb-2">
                Welcome, {firstName}! 🎉
              </h2>
              <p className="text-bf-dim text-sm leading-relaxed">
                Let's set up your budget in under 2 minutes. We'll configure
                your monthly income and default spending categories.
              </p>
              <button
                onClick={() => setStep(1)}
                className="mt-6 w-full py-3.5 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-[15px] font-bold cursor-pointer hover:opacity-90 transition"
              >
                Get Started →
              </button>
            </div>
          )}

          {/* Step 1 — Income */}
          {step === 1 && (
            <div>
              <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono mb-1">
                Step 1 of 3
              </div>
              <h2 className="text-xl font-bold mb-1">Monthly Income</h2>
              <p className="text-bf-dim text-sm mb-5">
                What's your take-home pay each month after tax?
              </p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-bf-dim text-sm">
                  $
                </span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  autoFocus
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl pl-7 pr-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition text-lg font-mono"
                  placeholder="5500"
                />
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setStep(0)}
                  className="px-5 py-2.5 rounded-xl border border-white/[0.1] text-sm text-bf-dim hover:text-bf-text transition cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!income || parseFloat(income) <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-bf-accent/[0.15] border border-bf-accent/[0.25] text-bf-accent text-sm font-semibold disabled:opacity-40 hover:bg-bf-accent/[0.22] transition cursor-pointer"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Categories */}
          {step === 2 && (
            <div>
              <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono mb-1">
                Step 2 of 3
              </div>
              <h2 className="text-xl font-bold mb-1">Budget Categories</h2>
              <p className="text-bf-dim text-sm mb-4">
                Adjust your monthly budget for each category. You can change
                these later in Setup.
              </p>
              <div
                className="flex flex-col gap-2 overflow-y-auto pr-1"
                style={{ maxHeight: "300px" }}
              >
                {DEFAULT_CATEGORIES.map((cat) => (
                  <div
                    key={cat.slug}
                    className="flex items-center gap-3 py-1.5"
                  >
                    <span className="text-xl leading-none w-7 text-center">
                      {cat.emoji}
                    </span>
                    <span className="flex-1 text-[13px] font-medium">
                      {cat.name}
                    </span>
                    <div className="relative w-28">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-bf-dim text-xs">
                        $
                      </span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={catBudgets[cat.slug]}
                        onChange={(e) =>
                          setCatBudgets((prev) => ({
                            ...prev,
                            [cat.slug]: e.target.value,
                          }))
                        }
                        className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg pl-6 pr-2 py-1.5 text-sm text-bf-text outline-none focus:border-bf-accent/30 transition font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-xl border border-white/[0.1] text-sm text-bf-dim hover:text-bf-text transition cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-2.5 rounded-xl bg-bf-accent/[0.15] border border-bf-accent/[0.25] text-bf-accent text-sm font-semibold hover:bg-bf-accent/[0.22] transition cursor-pointer"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Confirm */}
          {step === 3 && (
            <div className="text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-bold mb-2">You're all set!</h2>
              <p className="text-bf-dim text-sm leading-relaxed mb-2">
                We'll create your budget categories and add default recurring
                expenses (Rent, Phone Plan, Netflix + Spotify).
              </p>
              <p className="text-bf-dim text-sm">
                Head to <span className="text-bf-accent">Budget</span> to log
                your first expense by chatting.
              </p>
              <button
                onClick={handleFinish}
                disabled={saving}
                className="mt-6 w-full py-3.5 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-[15px] font-bold cursor-pointer disabled:opacity-50 hover:opacity-90 transition"
              >
                {saving ? "Setting up..." : "Start Budgeting 🚀"}
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={saving}
                className="mt-2 text-sm text-bf-dim cursor-pointer bg-transparent border-none hover:text-bf-text transition"
              >
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard Layout ─────────────────────────────────────────────────────────
export default function DashboardLayout({ children }) {
  const [profile, setProfile] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p);
        // Show onboarding wizard for new users who haven't completed it
        if (p && p.onboarded === false) {
          setShowOnboarding(true);
        }
      })
      .catch(console.error);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    // Refresh profile and navigate to budget page to start chatting
    getProfile().then(setProfile).catch(console.error);
    router.push("/budget");
    router.refresh();
  };

  const activeTab =
    NAV_ITEMS.find((n) => pathname.startsWith(n.href))?.id || "dashboard";

  return (
    <div className="min-h-screen bg-bf-bg text-bf-text font-sans">
      {/* Top Nav */}
      <div className="h-[52px] px-4 flex items-center justify-between border-b border-white/[0.07] bg-bf-bg/95 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-[26px] h-[26px] rounded-[7px] bg-gradient-to-br from-bf-accent to-emerald-600 flex items-center justify-center text-xs font-bold text-bf-bg">
            B
          </div>
          <span className="text-[15px] font-bold tracking-tight">
            budget<span className="text-bf-accent">flow</span>
          </span>
        </div>

        <div className="flex gap-0.5 items-center">
          {NAV_ITEMS.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(t.href)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === t.id
                  ? "bg-bf-accent/10 border border-bf-accent/20 text-bf-accent"
                  : "border border-transparent text-bf-dim hover:text-bf-text"
              }`}
            >
              <span className="text-[9px]">{t.icon}</span> {t.label}
            </button>
          ))}

          <div className="w-px h-5 bg-white/[0.07] mx-1.5" />

          <div className="flex items-center gap-2">
            <div className="w-[26px] h-[26px] rounded-lg bg-bf-accent/10 border border-bf-accent/20 flex items-center justify-center text-[11px] font-bold text-bf-accent">
              {(profile?.name || "U").charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-bf-dim max-w-[80px] truncate">
              {profile?.name?.split(" ")[0] || "User"}
            </span>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="bg-transparent border-none text-white/20 cursor-pointer text-sm px-1 hover:text-white/50 transition"
            >
              ⏻
            </button>
          </div>
        </div>
      </div>

      {/* Page Content */}
      {children}

      {/* Onboarding Wizard — shown as overlay for new users */}
      {showOnboarding && (
        <OnboardingWizard
          profile={profile}
          onComplete={handleOnboardingComplete}
        />
      )}
    </div>
  );
}

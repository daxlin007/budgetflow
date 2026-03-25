"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase-browser";
import { updateProfile, insertCategories, insertRecurringBatch } from "../lib/db";

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

const DEFAULT_RECURRING = [
  { slug: "rent", description: "Rent", amount: 1800 },
  { slug: "utilities", description: "Phone Plan", amount: 75 },
  { slug: "subscriptions", description: "Netflix + Spotify", amount: 28.99 },
];

const STEPS = ["Welcome", "Income", "Categories", "Recurring", "Done"];

const inputCls = "w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition font-mono";
const labelCls = "text-[11px] text-bf-dim tracking-widest uppercase font-mono block mb-1";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Check if already onboarded and redirect to dashboard
  useEffect(() => {
    const checkOnboarding = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("Onboarding page - user:", user?.id);

      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("onboarded, name")
          .eq("id", user.id)
          .single();

        console.log("Profile check in onboarding:", { profile, profileError });

        if (profileError) {
          // Profile doesn't exist - create it
          console.log("Creating profile for new user in onboarding");
          const { error: createError, data: createData } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              name: user.user_metadata?.name || "User",
              onboarded: false,
            })
            .select();

          if (createError) {
            console.error("Error creating profile:", {
              code: createError.code,
              message: createError.message,
              details: createError.details,
            });
          } else {
            console.log("Profile created in onboarding:", createData);
          }
        } else if (profile?.onboarded) {
          console.log("User already onboarded, redirecting to dashboard");
          router.push("/dashboard");
        }
      }
    };
    checkOnboarding();
  }, [router, supabase]);

  // Step 1: Income
  const [income, setIncome] = useState("5500");

  // Step 2: Categories
  const [selectedCats, setSelectedCats] = useState(
    DEFAULT_CATEGORIES.reduce((acc, c) => ({ ...acc, [c.slug]: true }), {})
  );
  const [catBudgets, setCatBudgets] = useState(
    DEFAULT_CATEGORIES.reduce((acc, c) => ({ ...acc, [c.slug]: String(c.budget) }), {})
  );
  const [customCats, setCustomCats] = useState([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("📦");
  const [newCatBudget, setNewCatBudget] = useState("0");

  // Step 3: Recurring
  const [selectedRec, setSelectedRec] = useState(
    DEFAULT_RECURRING.reduce((acc, r) => ({ ...acc, [r.slug + r.description]: true }), {})
  );
  const [recAmounts, setRecAmounts] = useState(
    DEFAULT_RECURRING.reduce((acc, r) => ({ ...acc, [r.slug + r.description]: String(r.amount) }), {})
  );
  const [customRec, setCustomRec] = useState([]);
  const [newRecDesc, setNewRecDesc] = useState("");
  const [newRecAmount, setNewRecAmount] = useState("0");
  const [newRecCat, setNewRecCat] = useState("");

  const totalBudget = DEFAULT_CATEGORIES
    .filter((c) => selectedCats[c.slug])
    .reduce((s, c) => s + (parseFloat(catBudgets[c.slug]) || 0), 0) +
    customCats.reduce((s, c) => s + (parseFloat(c.budget) || 0), 0);

  const addCustomCategory = () => {
    if (!newCatName.trim()) {
      setError("Category name is required");
      return;
    }
    const slug = newCatName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (customCats.some((c) => c.slug === slug) || DEFAULT_CATEGORIES.some((c) => c.slug === slug)) {
      setError("Category already exists");
      return;
    }
    setCustomCats([...customCats, { slug, name: newCatName, emoji: newCatEmoji, budget: parseFloat(newCatBudget) || 0, color: "#7CC5A8", isCustom: true }]);
    setNewCatName("");
    setNewCatEmoji("📦");
    setNewCatBudget("0");
    setError("");
  };

  const removeCustomCategory = (idx) => {
    setCustomCats(customCats.filter((_, i) => i !== idx));
  };

  const toggleDefaultCategory = (slug) => {
    setSelectedCats((p) => ({ ...p, [slug]: !p[slug] }));
  };

  // Get all available categories for recurring expenses (selected defaults + custom)
  const getAvailableCategories = () => {
    const availableDefaults = DEFAULT_CATEGORIES.filter((c) => selectedCats[c.slug]);
    return [...availableDefaults, ...customCats];
  };

  const addCustomRecurring = () => {
    if (!newRecDesc.trim()) {
      setError("Description is required");
      return;
    }
    if (!newRecCat) {
      setError("Please select a category");
      return;
    }
    const catObj = getAvailableCategories().find((c) => c.slug === newRecCat);
    if (!catObj) {
      setError("Selected category not available");
      return;
    }
    setCustomRec([...customRec, {
      slug: newRecCat,
      description: newRecDesc,
      amount: parseFloat(newRecAmount) || 0,
      emoji: catObj.emoji
    }]);
    setNewRecDesc("");
    setNewRecAmount("0");
    setNewRecCat("");
    setError("");
  };

  const removeCustomRecurring = (idx) => {
    setCustomRec(customRec.filter((_, i) => i !== idx));
  };

  const handleFinish = async () => {
    setError("");
    setSaving(true);
    try {
      // Save income
      await updateProfile({ monthly_income: parseFloat(income) || 5500, onboarded: true });

      // Save selected categories (defaults + custom)
      const defaultCats = DEFAULT_CATEGORIES
        .filter((c) => selectedCats[c.slug])
        .map((c) => ({ ...c, budget: parseFloat(catBudgets[c.slug]) || c.budget }));
      const allCats = [...defaultCats, ...customCats];
      const savedCats = await insertCategories(allCats);

      if (!savedCats || savedCats.length === 0) {
        throw new Error("Failed to create categories. Please try again.");
      }

      // Save selected recurring (matched to saved category IDs)
      const catBySlug = {};
      (savedCats || []).forEach((c) => { if (c && c.slug) catBySlug[c.slug] = c; });

      const defaultRecs = DEFAULT_RECURRING
        .filter((r) => selectedRec[r.slug + r.description] && catBySlug[r.slug])
        .map((r) => ({
          category_id: catBySlug[r.slug].id,
          description: r.description,
          amount: parseFloat(recAmounts[r.slug + r.description]) || r.amount,
        }));

      const customRecs = customRec
        .filter((r) => catBySlug[r.slug])
        .map((r) => ({
          category_id: catBySlug[r.slug].id,
          description: r.description,
          amount: parseFloat(r.amount) || 0,
        }));

      const allRecs = [...defaultRecs, ...customRecs];
      if (allRecs.length > 0) {
        const savedRecs = await insertRecurringBatch(allRecs);
        if (!savedRecs || !Array.isArray(savedRecs)) {
          console.warn("Recurring expenses created but response was invalid");
        }
      }

      router.push("/dashboard");
    } catch (e) {
      setError(e.message || "Something went wrong. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-bf-bg text-bf-text flex flex-col items-center justify-center px-4 py-12">
      <div className="fixed inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, rgba(124,197,168,0.8) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="w-full max-w-[480px] relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 inline-flex items-center justify-center text-lg font-extrabold text-bf-bg mb-3">B</div>
          <h1 className="text-2xl font-bold tracking-tight">budget<span className="text-bf-accent">flow</span></h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono transition ${i < step ? "bg-bf-accent text-bf-bg" : i === step ? "bg-bf-accent/20 border border-bf-accent text-bf-accent" : "bg-white/[0.05] border border-white/[0.1] text-bf-dim"}`}>
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-6 h-px ${i < step ? "bg-bf-accent/40" : "bg-white/[0.07]"}`} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-7">

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center">
              <div className="text-5xl mb-4">👋</div>
              <h2 className="text-2xl font-bold mb-2">Welcome to BudgetFlow!</h2>
              <p className="text-bf-dim text-sm leading-relaxed mb-6">
                Let's get you set up in just 3 quick steps.<br />
                We'll set your income, pick budget categories, and add any recurring bills.
              </p>
              <button
                onClick={() => setStep(1)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-[15px] font-bold cursor-pointer transition hover:opacity-90"
              >
                Let's Go →
              </button>
            </div>
          )}

          {/* Step 1: Income */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold mb-1">Monthly Income</h2>
              <p className="text-bf-dim text-sm mb-6">Your total take-home pay per month. Used to calculate savings rate.</p>
              <div className="mb-6">
                <label className={labelCls}>Monthly Take-Home (after tax)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-bf-dim font-mono">$</span>
                  <input
                    type="number"
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-8 pr-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition font-mono text-lg"
                    placeholder="5500"
                    min="0"
                  />
                </div>
                <p className="text-[11px] text-bf-dim mt-2">You can always change this in Settings later.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/[0.07] text-bf-dim text-sm cursor-pointer hover:bg-white/[0.07] transition">← Back</button>
                <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-sm font-bold cursor-pointer transition hover:opacity-90">Next →</button>
              </div>
            </div>
          )}

          {/* Step 2: Categories */}
          {step === 2 && (
            <div className="flex flex-col h-[520px]">
              <h2 className="text-xl font-bold mb-1">Budget Categories</h2>
              <p className="text-bf-dim text-sm mb-3">Select which categories to track and set your monthly budget for each.</p>

              {/* Add Custom Category Form - Compact */}
              <div className="bg-bf-accent/[0.06] border border-bf-accent/20 rounded-lg p-2 mb-3">
                <div className="grid grid-cols-4 gap-1.5">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="col-span-2 bg-white/[0.04] border border-white/[0.07] rounded px-2 py-1 text-xs outline-none focus:border-bf-accent/30"
                  />
                  <input
                    type="text"
                    placeholder="🎯"
                    value={newCatEmoji}
                    onChange={(e) => setNewCatEmoji(e.target.value.slice(0, 2))}
                    maxLength="2"
                    className="bg-white/[0.04] border border-white/[0.07] rounded px-2 py-1 text-xs text-center outline-none focus:border-bf-accent/30"
                  />
                  <input
                    type="number"
                    placeholder="$"
                    value={newCatBudget}
                    onChange={(e) => setNewCatBudget(e.target.value)}
                    min="0"
                    className="bg-white/[0.04] border border-white/[0.07] rounded px-2 py-1 text-xs outline-none focus:border-bf-accent/30"
                  />
                  <button
                    onClick={addCustomCategory}
                    className="col-span-4 px-2 py-1 rounded bg-bf-accent/20 text-bf-accent hover:bg-bf-accent/30 transition text-xs font-semibold"
                  >
                    ➕ Add Category
                  </button>
                </div>
                {error && (
                  <p className="text-xs text-bf-accent2 mt-1">{error}</p>
                )}
              </div>

              {/* Scrollable Category List */}
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="flex flex-col gap-2">
                  {/* Custom Categories */}
                  {customCats.length > 0 && (
                    <>
                      <p className="text-xs text-bf-dim font-mono uppercase tracking-widest sticky top-0 bg-white/[0.03] py-1 px-1">Your Categories ({customCats.length})</p>
                      {customCats.map((cat, idx) => (
                        <div
                          key={`custom-${idx}`}
                          className="rounded-xl p-3 border border-bf-accent/30 bg-bf-accent/[0.05]"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{cat.emoji}</span>
                              <span className="text-sm font-medium">{cat.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={cat.budget}
                                onChange={(e) => setCustomCats(customCats.map((c, i) => i === idx ? { ...c, budget: parseFloat(e.target.value) || 0 } : c))}
                                className="w-20 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1 text-xs font-mono text-right outline-none focus:border-bf-accent/30"
                                min="0"
                              />
                              <button
                                onClick={() => removeCustomCategory(idx)}
                                className="text-bf-dim hover:text-bf-accent2 transition text-lg leading-none"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Default Categories */}
                  <p className="text-xs text-bf-dim font-mono uppercase tracking-widest sticky top-0 bg-white/[0.03] py-1 px-1 mt-2">{customCats.length > 0 ? "Default Categories" : "Available Categories"}</p>
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <div
                      key={cat.slug}
                      className={`rounded-xl p-3 border transition cursor-pointer ${selectedCats[cat.slug] ? "border-bf-accent/30 bg-bf-accent/[0.05]" : "border-white/[0.07] bg-white/[0.02] opacity-50"}`}
                      onClick={() => toggleDefaultCategory(cat.slug)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded flex items-center justify-center text-[9px] border ${selectedCats[cat.slug] ? "bg-bf-accent border-bf-accent text-bf-bg" : "border-white/[0.2]"}`}>
                            {selectedCats[cat.slug] && "✓"}
                          </div>
                          <span className="text-base">{cat.emoji}</span>
                          <span className="text-sm font-medium">{cat.name}</span>
                        </div>
                        {selectedCats[cat.slug] && (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-bf-dim font-mono">$</span>
                            <input
                              type="number"
                              value={catBudgets[cat.slug]}
                              onChange={(e) => setCatBudgets((p) => ({ ...p, [cat.slug]: e.target.value }))}
                              className="w-20 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1 text-xs font-mono text-right outline-none focus:border-bf-accent/30"
                              min="0"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Budget and Buttons */}
              <div className="flex items-center justify-between py-2 border-t border-white/[0.07] mt-3 mb-3">
                <span className="text-xs text-bf-dim font-mono">Total Budget</span>
                <span className="text-sm font-bold font-mono text-bf-accent">${totalBudget.toLocaleString("en-CA", { minimumFractionDigits: 0 })}/mo</span>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/[0.07] text-bf-dim text-sm cursor-pointer hover:bg-white/[0.07] transition">← Back</button>
                <button onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-sm font-bold cursor-pointer transition hover:opacity-90">Next →</button>
              </div>
            </div>
          )}

          {/* Step 3: Recurring */}
          {step === 3 && (
            <div className="flex flex-col h-[520px]">
              <h2 className="text-xl font-bold mb-1">Recurring Expenses</h2>
              <p className="text-bf-dim text-sm mb-3">These auto-populate at the start of every month so you don't have to add them manually.</p>

              {/* Add Custom Recurring Form */}
              {getAvailableCategories().length > 0 && (
                <div className="bg-bf-accent/[0.06] border border-bf-accent/20 rounded-lg p-2 mb-3">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Description"
                      value={newRecDesc}
                      onChange={(e) => setNewRecDesc(e.target.value)}
                      className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded px-2 py-1 text-xs outline-none focus:border-bf-accent/30"
                    />
                    <select
                      value={newRecCat}
                      onChange={(e) => setNewRecCat(e.target.value)}
                      className="bg-white/[0.04] border border-white/[0.07] rounded px-2 py-1 text-xs outline-none focus:border-bf-accent/30"
                    >
                      <option value="">Select Category</option>
                      {getAvailableCategories().map((cat) => (
                        <option key={cat.slug} value={cat.slug}>
                          {cat.emoji} {cat.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="$"
                      value={newRecAmount}
                      onChange={(e) => setNewRecAmount(e.target.value)}
                      min="0"
                      step="0.01"
                      className="w-20 bg-white/[0.04] border border-white/[0.07] rounded px-2 py-1 text-xs outline-none focus:border-bf-accent/30"
                    />
                    <button
                      onClick={addCustomRecurring}
                      className="px-2 py-1 rounded bg-bf-accent/20 text-bf-accent hover:bg-bf-accent/30 transition text-xs font-semibold"
                    >
                      ➕
                    </button>
                  </div>
                  {error && (
                    <p className="text-xs text-bf-accent2 mt-1">{error}</p>
                  )}
                </div>
              )}

              {/* Scrollable Recurring List */}
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="flex flex-col gap-2">
                  {/* Custom Recurring */}
                  {customRec.length > 0 && (
                    <>
                      <p className="text-xs text-bf-dim font-mono uppercase tracking-widest sticky top-0 bg-white/[0.03] py-1 px-1">Your Recurring ({customRec.length})</p>
                      {customRec.map((rec, idx) => (
                        <div key={`custom-rec-${idx}`} className="rounded-xl p-3 border border-bf-accent/30 bg-bf-accent/[0.05]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{rec.emoji}</span>
                              <div>
                                <p className="text-sm font-medium">{rec.description}</p>
                                <p className="text-xs text-bf-dim">{getAvailableCategories().find((c) => c.slug === rec.slug)?.name}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={rec.amount}
                                onChange={(e) => setCustomRec(customRec.map((r, i) => i === idx ? { ...r, amount: parseFloat(e.target.value) || 0 } : r))}
                                className="w-20 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1 text-xs font-mono text-right outline-none focus:border-bf-accent/30"
                                min="0"
                                step="0.01"
                              />
                              <button
                                onClick={() => removeCustomRecurring(idx)}
                                className="text-bf-dim hover:text-bf-accent2 transition text-lg leading-none"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Default Recurring */}
                  {DEFAULT_RECURRING.length > 0 && (
                    <p className="text-xs text-bf-dim font-mono uppercase tracking-widest sticky top-0 bg-white/[0.03] py-1 px-1 mt-2">{customRec.length > 0 ? "Default Recurring" : "Available Recurring"}</p>
                  )}
                  {DEFAULT_RECURRING.map((rec) => {
                    const key = rec.slug + rec.description;
                    const cat = DEFAULT_CATEGORIES.find((c) => c.slug === rec.slug);
                    const catSelected = selectedCats[rec.slug];
                    return (
                      <div
                        key={key}
                        className={`rounded-xl p-3 border transition ${!catSelected ? "opacity-30 pointer-events-none" : selectedRec[key] ? "border-bf-accent/30 bg-bf-accent/[0.05] cursor-pointer" : "border-white/[0.07] bg-white/[0.02] opacity-50 cursor-pointer"}`}
                        onClick={() => catSelected && setSelectedRec((p) => ({ ...p, [key]: !p[key] }))}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded flex items-center justify-center text-[9px] border ${selectedRec[key] ? "bg-bf-accent border-bf-accent text-bf-bg" : "border-white/[0.2]"}`}>
                              {selectedRec[key] && "✓"}
                            </div>
                            <span className="text-base">{cat?.emoji}</span>
                            <div>
                              <p className="text-sm font-medium">{rec.description}</p>
                              <p className="text-xs text-bf-dim">{cat?.name}</p>
                            </div>
                          </div>
                          {selectedRec[key] && (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <span className="text-xs text-bf-dim font-mono">$</span>
                              <input
                                type="number"
                                value={recAmounts[key]}
                                onChange={(e) => setRecAmounts((p) => ({ ...p, [key]: e.target.value }))}
                                className="w-20 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1 text-xs font-mono text-right outline-none focus:border-bf-accent/30"
                                min="0"
                                step="0.01"
                              />
                            </div>
                          )}
                        </div>
                        {!catSelected && <p className="text-[10px] text-bf-dim mt-1 ml-6">Enable the "{cat?.name}" category first.</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 mt-3">
                <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/[0.07] text-bf-dim text-sm cursor-pointer hover:bg-white/[0.07] transition">← Back</button>
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-sm font-bold cursor-pointer disabled:opacity-50 transition hover:opacity-90"
                >
                  {saving ? "Setting up..." : "Finish Setup →"}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-bf-dim mt-4">
          Already set up?{" "}
          <button onClick={() => router.push("/dashboard")} className="text-bf-accent bg-transparent border-none cursor-pointer">
            Skip to dashboard →
          </button>
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  getProfile,
  updateProfile,
  getCategories,
  upsertCategory,
  deleteCategory,
  getRecurring,
  insertRecurring,
  deleteRecurring,
} from "../../lib/db";

const fmt = (n) =>
  `$${parseFloat(n || 0).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function SetupPage() {
  const [profile, setProfile] = useState(null);
  const [cats, setCats] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);

  // Income editing
  const [editIncome, setEditIncome] = useState(false);
  const [incomeVal, setIncomeVal] = useState("");
  const [savingIncome, setSavingIncome] = useState(false);

  // Category budget inline editing — keyed by category id
  const [editCat, setEditCat] = useState(null); // { id, budget: string }
  const [savingCat, setSavingCat] = useState(false);

  // New category form
  const PRESET_COLORS = ["#7CC5A8","#E8927C","#7CAFC5","#C5B87C","#A87CC5","#C57CA8","#7CC5C5","#C57C7C"];
  const [newCat, setNewCat] = useState({ name: "", emoji: "📦", budget: "", color: "#7CC5A8" });
  const [addingCat, setAddingCat] = useState(false);

  // New recurring expense form
  const [newRec, setNewRec] = useState({
    description: "",
    amount: "",
    category_id: "",
  });
  const [addingRec, setAddingRec] = useState(false);

  useEffect(() => {
    Promise.all([getProfile(), getCategories(), getRecurring()])
      .then(([p, c, r]) => {
        setProfile(p);
        setCats(c || []);
        setRecurring(r || []);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  // ── Income ────────────────────────────────────────────────────────────────
  const startEditIncome = () => {
    setIncomeVal(String(profile?.monthly_income || ""));
    setEditIncome(true);
  };

  const handleSaveIncome = async () => {
    const val = parseFloat(incomeVal);
    if (isNaN(val) || val < 0) return;
    setSavingIncome(true);
    try {
      const updated = await updateProfile({ monthly_income: val });
      setProfile(updated);
      setEditIncome(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingIncome(false);
    }
  };

  // ── Category budget ───────────────────────────────────────────────────────
  const handleSaveCatBudget = async () => {
    if (!editCat) return;
    const val = parseFloat(editCat.budget);
    if (isNaN(val) || val < 0) return;
    setSavingCat(true);
    try {
      const updated = await upsertCategory({ id: editCat.id, budget: val });
      setCats((prev) =>
        prev.map((c) => (c.id === editCat.id ? { ...c, ...updated } : c))
      );
      setEditCat(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingCat(false);
    }
  };

  // ── Add / delete category ─────────────────────────────────────────────────
  const handleAddCategory = async () => {
    if (!newCat.name.trim() || !newCat.budget) return;
    const amount = parseFloat(newCat.budget);
    if (isNaN(amount) || amount < 0) return;
    setAddingCat(true);
    try {
      const slug = newCat.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const maxOrder = cats.reduce((m, c) => Math.max(m, c.sort_order || 0), 0);
      const inserted = await upsertCategory({
        slug,
        name: newCat.name.trim(),
        emoji: newCat.emoji || "📦",
        budget: amount,
        color: newCat.color,
        sort_order: maxOrder + 1,
      });
      setCats((prev) => [...prev, inserted]);
      setNewCat({ name: "", emoji: "📦", budget: "", color: "#7CC5A8" });
    } catch (e) {
      console.error(e);
    } finally {
      setAddingCat(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm("Delete this category? Existing transactions will become uncategorized.")) return;
    try {
      await deleteCategory(id);
      setCats((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // ── Recurring ─────────────────────────────────────────────────────────────
  const handleAddRecurring = async () => {
    if (!newRec.description.trim() || !newRec.amount) return;
    const amount = parseFloat(newRec.amount);
    if (isNaN(amount) || amount <= 0) return;
    setAddingRec(true);
    try {
      const inserted = await insertRecurring({
        description: newRec.description.trim(),
        amount,
        category_id: newRec.category_id || null,
      });
      setRecurring((prev) => [...prev, inserted]);
      setNewRec({ description: "", amount: "", category_id: "" });
    } catch (e) {
      console.error(e);
    } finally {
      setAddingRec(false);
    }
  };

  const handleDeleteRecurring = async (id) => {
    if (!confirm("Remove this recurring expense?")) return;
    try {
      await deleteRecurring(id);
      setRecurring((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-bf-dim text-sm font-mono">
        Loading...
      </div>
    );
  }

  const totalBudget = cats.reduce((s, c) => s + parseFloat(c.budget || 0), 0);

  return (
    <div className="max-w-[680px] mx-auto px-5 py-6 flex flex-col gap-5">
      {/* ── Monthly Income ──────────────────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
        <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono mb-3">
          Monthly Income
        </div>
        {editIncome ? (
          <div className="flex gap-2">
            <input
              type="number"
              step="1"
              min="0"
              value={incomeVal}
              onChange={(e) => setIncomeVal(e.target.value)}
              autoFocus
              className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-bf-text outline-none focus:border-bf-accent/30 transition"
              placeholder="e.g. 5500"
            />
            <button
              onClick={handleSaveIncome}
              disabled={savingIncome}
              className="px-4 py-2.5 rounded-xl bg-bf-accent/[0.15] border border-bf-accent/[0.25] text-bf-accent text-sm font-semibold disabled:opacity-40 hover:bg-bf-accent/[0.22] transition cursor-pointer"
            >
              {savingIncome ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditIncome(false)}
              className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-sm text-bf-dim hover:text-bf-text transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold font-mono">
                {fmt(profile?.monthly_income || 0)}
              </span>
              <span className="text-[11px] text-bf-dim ml-2">/ month</span>
            </div>
            <button
              onClick={startEditIncome}
              className="text-xs text-bf-accent bg-bf-accent/[0.08] border border-bf-accent/[0.18] rounded-lg px-3 py-1.5 hover:bg-bf-accent/[0.14] transition cursor-pointer"
            >
              Edit
            </button>
          </div>
        )}
        {!editIncome && totalBudget > 0 && (
          <div className="text-[11px] text-bf-dim mt-2">
            Total budgeted:{" "}
            <span className="text-bf-text font-mono">{fmt(totalBudget)}</span>
            {profile?.monthly_income && (
              <span className="ml-1.5">
                (
                {Math.round(
                  (totalBudget / parseFloat(profile.monthly_income)) * 100
                )}
                % of income)
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Budget Categories ───────────────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
        <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono mb-3">
          Budget Categories
        </div>
        <div className="flex flex-col gap-1">
          {cats.length === 0 && (
            <div className="text-bf-dim text-sm py-2">No categories yet.</div>
          )}
          {cats.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0"
            >
              <span className="text-lg leading-none">{cat.emoji}</span>
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: cat.color }}
              />
              <span className="flex-1 text-[13px] font-medium">{cat.name}</span>

              {editCat?.id === cat.id ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={editCat.budget}
                    onChange={(e) =>
                      setEditCat((prev) => ({ ...prev, budget: e.target.value }))
                    }
                    autoFocus
                    className="w-28 bg-white/[0.04] border border-white/[0.1] rounded-lg px-2 py-1.5 text-sm text-bf-text outline-none focus:border-bf-accent/30 transition"
                  />
                  <button
                    onClick={handleSaveCatBudget}
                    disabled={savingCat}
                    className="px-3 py-1.5 rounded-lg bg-bf-accent/[0.15] border border-bf-accent/[0.25] text-bf-accent text-xs font-semibold disabled:opacity-40 hover:bg-bf-accent/[0.22] transition cursor-pointer"
                  >
                    {savingCat ? "..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditCat(null)}
                    className="px-3 py-1.5 rounded-lg border border-white/[0.1] text-xs text-bf-dim hover:text-bf-text transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-mono text-bf-dim">
                    {fmt(cat.budget)}
                  </span>
                  <button
                    onClick={() =>
                      setEditCat({ id: cat.id, budget: String(cat.budget) })
                    }
                    className="text-[11px] text-bf-dim border border-white/[0.08] rounded-md px-2 py-1 hover:text-bf-text hover:border-white/[0.15] transition cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="text-[11px] text-bf-accent2/50 border border-white/[0.08] rounded-md px-2 py-1 hover:text-bf-accent2 hover:border-bf-accent2/30 transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add new category */}
        <div className="pt-4 mt-2 border-t border-white/[0.07]">
          <div className="text-[10px] text-bf-dim tracking-widest uppercase font-mono mb-3">
            Add Category
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Emoji */}
            <input
              value={newCat.emoji}
              onChange={(e) => setNewCat((p) => ({ ...p, emoji: e.target.value }))}
              maxLength={2}
              placeholder="📦"
              className="w-14 bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-bf-text outline-none focus:border-bf-accent/30 transition text-center"
            />
            {/* Name */}
            <input
              value={newCat.name}
              onChange={(e) => setNewCat((p) => ({ ...p, name: e.target.value }))}
              placeholder="Category name"
              className="flex-1 min-w-[120px] bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-bf-text outline-none focus:border-bf-accent/30 transition"
            />
            {/* Monthly budget */}
            <input
              type="number"
              step="1"
              min="0"
              value={newCat.budget}
              onChange={(e) => setNewCat((p) => ({ ...p, budget: e.target.value }))}
              placeholder="Budget $"
              className="w-28 bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-bf-text outline-none focus:border-bf-accent/30 transition"
            />
          </div>
          {/* Color swatches */}
          <div className="flex gap-2 mt-2.5 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewCat((p) => ({ ...p, color: c }))}
                className="w-6 h-6 rounded-full border-2 transition cursor-pointer"
                style={{
                  background: c,
                  borderColor: newCat.color === c ? "white" : "transparent",
                }}
              />
            ))}
          </div>
          <button
            onClick={handleAddCategory}
            disabled={addingCat || !newCat.name.trim() || !newCat.budget}
            className="mt-3 px-5 py-2.5 rounded-xl bg-bf-accent/[0.15] border border-bf-accent/[0.25] text-bf-accent text-sm font-semibold disabled:opacity-40 hover:bg-bf-accent/[0.22] transition cursor-pointer"
          >
            {addingCat ? "Adding..." : "+ Add Category"}
          </button>
        </div>
      </div>

      {/* ── Recurring Expenses ──────────────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
        <div className="text-[11px] text-bf-dim tracking-widests uppercase font-mono mb-3">
          Recurring Expenses
        </div>
        <div className="text-[10px] text-bf-dim mb-3">
          These are auto-populated on the 1st of each month.
        </div>

        <div className="flex flex-col gap-1 mb-4">
          {recurring.length === 0 && (
            <div className="text-bf-dim text-sm py-1">
              No recurring expenses yet.
            </div>
          )}
          {recurring.map((rec) => {
            const cat = cats.find((c) => c.id === rec.category_id);
            return (
              <div
                key={rec.id}
                className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0"
              >
                <span className="text-lg">{cat?.emoji || "📦"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] truncate">{rec.description}</div>
                  <div className="text-[10px] text-bf-dim">
                    {cat?.name || "Uncategorized"}
                  </div>
                </div>
                <span className="text-[13px] font-mono font-semibold text-bf-accent2 mr-2">
                  {fmt(rec.amount)}
                </span>
                <button
                  onClick={() => handleDeleteRecurring(rec.id)}
                  className="text-[11px] text-bf-accent2/60 border border-white/[0.08] rounded-md px-2 py-1 hover:text-bf-accent2 hover:border-bf-accent2/30 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {/* Add form */}
        <div className="pt-3 border-t border-white/[0.07]">
          <div className="text-[10px] text-bf-dim tracking-widest uppercase font-mono mb-2">
            Add Recurring
          </div>
          <div className="flex gap-2 flex-wrap">
            <input
              value={newRec.description}
              onChange={(e) =>
                setNewRec((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="e.g. Netflix"
              className="flex-1 min-w-[130px] bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-bf-text outline-none focus:border-bf-accent/30 transition"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={newRec.amount}
              onChange={(e) =>
                setNewRec((p) => ({ ...p, amount: e.target.value }))
              }
              placeholder="Amount"
              className="w-28 bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-bf-text outline-none focus:border-bf-accent/30 transition"
            />
            <select
              value={newRec.category_id}
              onChange={(e) =>
                setNewRec((p) => ({ ...p, category_id: e.target.value }))
              }
              className="flex-1 min-w-[130px] bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-bf-text outline-none focus:border-bf-accent/30 transition"
            >
              <option value="">Uncategorized</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddRecurring}
              disabled={
                addingRec || !newRec.description.trim() || !newRec.amount
              }
              className="px-4 py-2.5 rounded-xl bg-bf-accent/[0.15] border border-bf-accent/[0.25] text-bf-accent text-sm font-semibold disabled:opacity-40 hover:bg-bf-accent/[0.22] transition cursor-pointer"
            >
              {addingRec ? "Adding..." : "+ Add"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Account ─────────────────────────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
        <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono mb-3">
          Account
        </div>
        <div className="text-[13px] text-bf-dim">
          Signed in as{" "}
          <span className="text-bf-text font-medium">{profile?.name}</span>
        </div>
      </div>
    </div>
  );
}

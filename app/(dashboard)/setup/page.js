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
  populateRecurringForMonth,
} from "../../lib/db";

const nowKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const fmt = (n) =>
  `$${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const inputCls =
  "bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-bf-text focus:outline-none focus:border-bf-accent/50 w-full";
const btnPrimary =
  "bg-bf-accent text-bf-bg text-sm font-semibold rounded-lg px-4 py-2 hover:opacity-90 transition disabled:opacity-40";
const btnGhost =
  "bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-bf-dim hover:text-bf-text hover:bg-white/[0.08] transition";
const btnDanger =
  "bg-transparent border-none text-bf-dim hover:text-bf-accent2 text-lg px-1 transition";
const sectionCls = "bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 mb-4";
const labelCls = "text-[11px] text-bf-dim tracking-widest uppercase font-mono mb-3";

const COLOR_CHOICES = ["#7CC5A8", "#E8927C", "#7CAFC5", "#C57CA8", "#C5B87C", "#A87CC5", "#7CC5C5", "#C57C7C"];
const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "category";

export default function SetupPage() {
  const [profile, setProfile] = useState(null);
  const [income, setIncome] = useState("");
  const [incomeSaved, setIncomeSaved] = useState(false);
  const [cats, setCats] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);

  // new category form
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📦");
  const [newBudget, setNewBudget] = useState("");
  const [newColor, setNewColor] = useState(COLOR_CHOICES[0]);

  // new recurring form
  const [recDesc, setRecDesc] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recCat, setRecCat] = useState("");

  const [populating, setPopulating] = useState(false);
  const [popMsg, setPopMsg] = useState("");

  useEffect(() => {
    Promise.all([getProfile(), getCategories(), getRecurring()])
      .then(([p, c, r]) => {
        setProfile(p);
        setIncome(p?.monthly_income != null ? String(parseFloat(p.monthly_income)) : "");
        setCats(c || []);
        setRecurring(r || []);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  async function saveIncome() {
    const val = parseFloat(income) || 0;
    try {
      await updateProfile({ monthly_income: val });
      setIncomeSaved(true);
      setTimeout(() => setIncomeSaved(false), 2000);
    } catch (e) {
      console.error(e);
      alert("Couldn't save income — try again.");
    }
  }

  async function saveCatBudget(cat, budget) {
    const val = parseFloat(budget) || 0;
    try {
      const updated = await upsertCategory({ ...cat, budget: val });
      setCats((prev) => prev.map((c) => (c.id === cat.id ? updated : c)));
    } catch (e) {
      console.error(e);
      alert("Couldn't save budget — try again.");
    }
  }

  async function addCategory() {
    const name = newName.trim();
    if (!name) return;
    const slug = slugify(name);
    if (cats.some((c) => c.slug === slug)) {
      alert("A category with a similar name already exists.");
      return;
    }
    try {
      const created = await upsertCategory({
        slug,
        name,
        emoji: newEmoji.trim() || "📦",
        budget: parseFloat(newBudget) || 0,
        color: newColor,
        sort_order: cats.length,
      });
      setCats((prev) => [...prev, created]);
      setNewName("");
      setNewEmoji("📦");
      setNewBudget("");
      setNewColor(COLOR_CHOICES[0]);
    } catch (e) {
      console.error(e);
      alert("Couldn't add category — try again.");
    }
  }

  async function removeCategory(id) {
    if (!window.confirm("Delete this category? Its transactions become uncategorized.")) return;
    try {
      await deleteCategory(id);
      setCats((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
      alert("Couldn't delete — try again.");
    }
  }

  async function addRecurring() {
    const desc = recDesc.trim();
    const amount = parseFloat(recAmount) || 0;
    if (!desc || amount <= 0 || !recCat) {
      alert("Give the recurring bill a description, amount, and category.");
      return;
    }
    try {
      const created = await insertRecurring({ description: desc, amount, category_id: recCat });
      setRecurring((prev) => [...prev, created]);
      setRecDesc("");
      setRecAmount("");
    } catch (e) {
      console.error(e);
      alert("Couldn't add — try again.");
    }
  }

  async function removeRecurring(id) {
    if (!window.confirm("Delete this recurring bill?")) return;
    try {
      await deleteRecurring(id);
      setRecurring((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);
      alert("Couldn't delete — try again.");
    }
  }

  async function populateMonth() {
    setPopulating(true);
    setPopMsg("");
    try {
      const n = await populateRecurringForMonth(nowKey());
      setPopMsg(n === 0 ? "This month's recurring bills are already recorded." : `Added ${n} recurring bill${n > 1 ? "s" : ""} to this month.`);
    } catch (e) {
      console.error(e);
      setPopMsg("Couldn't populate — try again.");
    } finally {
      setPopulating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-bf-dim text-sm font-mono">Loading settings…</div>
      </div>
    );
  }

  return (
    <div className="max-w-[780px] mx-auto px-5 py-6">
      <h1 className="text-2xl font-bold mb-5">Setup</h1>

      {/* Income */}
      <div className={sectionCls}>
        <div className={labelCls}>Monthly income</div>
        <div className="flex gap-2 items-center">
          <input
            type="number" min="0" step="0.01"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            className={`${inputCls} font-mono max-w-[200px]`}
          />
          <button onClick={saveIncome} className={btnPrimary}>Save</button>
          {incomeSaved && <span className="text-xs text-bf-accent">Saved ✓</span>}
        </div>
        <p className="text-[11px] text-bf-dim mt-2">Used for the “of income” and savings stats on the dashboard.</p>
      </div>

      {/* Categories */}
      <div className={sectionCls}>
        <div className={labelCls}>Categories</div>
        <div className="flex flex-col gap-2 mb-4">
          {cats.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2.5 py-1.5 border-b border-white/[0.04]">
              <span className="text-base w-7 text-center">{cat.emoji}</span>
              <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>
              <input
                type="number" min="0" step="0.01"
                defaultValue={parseFloat(cat.budget || 0)}
                key={`${cat.id}-${cat.budget}`}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  if (v !== parseFloat(cat.budget || 0)) saveCatBudget(cat, v);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-sm font-mono w-[110px] focus:outline-none focus:border-bf-accent/50"
                title="Monthly budget — edits save on blur"
              />
              <button onClick={() => removeCategory(cat.id)} className={btnDanger} title="Delete category">×</button>
            </div>
          ))}
          {cats.length === 0 && <div className="text-sm text-bf-dim">No categories yet — add your first below.</div>}
        </div>

        <div className="border-t border-white/[0.06] pt-4">
          <div className="text-xs text-bf-dim mb-2">Add category</div>
          <div className="flex gap-2 flex-wrap items-center">
            <input value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)} placeholder="📦" className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-sm w-[52px] text-center focus:outline-none focus:border-bf-accent/50" />
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name (e.g. Groceries)" className={`${inputCls} flex-1 min-w-[140px]`} />
            <input type="number" min="0" step="0.01" value={newBudget} onChange={(e) => setNewBudget(e.target.value)} placeholder="Budget" className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-mono w-[110px] focus:outline-none focus:border-bf-accent/50" />
            <button onClick={addCategory} disabled={!newName.trim()} className={btnPrimary}>Add</button>
          </div>
          <div className="flex gap-1.5 mt-2.5 items-center">
            <span className="text-[11px] text-bf-dim mr-1">Color</span>
            {COLOR_CHOICES.map((col) => (
              <button
                key={col}
                onClick={() => setNewColor(col)}
                className="w-6 h-6 rounded-full transition"
                style={{ background: col, outline: newColor === col ? "2px solid #fff" : "none", outlineOffset: 1 }}
                title={col}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Recurring bills */}
      <div className={sectionCls}>
        <div className={labelCls}>Recurring bills</div>
        <div className="flex flex-col gap-2 mb-4">
          {recurring.map((r) => {
            const cat = cats.find((c) => c.id === r.category_id);
            return (
              <div key={r.id} className="flex items-center gap-2.5 py-1.5 border-b border-white/[0.04]">
                <span className="text-base w-7 text-center">{cat?.emoji || "↻"}</span>
                <span className="flex-1 text-sm truncate">{r.description}</span>
                <span className="text-sm font-mono">{fmt(parseFloat(r.amount))}</span>
                <span className="text-[10px] text-bf-dim">{cat?.name}</span>
                <button onClick={() => removeRecurring(r.id)} className={btnDanger} title="Delete">×</button>
              </div>
            );
          })}
          {recurring.length === 0 && <div className="text-sm text-bf-dim">No recurring bills — mortgage, insurance, subscriptions live here.</div>}
        </div>

        <div className="border-t border-white/[0.06] pt-4">
          <div className="text-xs text-bf-dim mb-2">Add recurring bill</div>
          <div className="flex gap-2 flex-wrap">
            <input value={recDesc} onChange={(e) => setRecDesc(e.target.value)} placeholder="Description" className={`${inputCls} flex-1 min-w-[140px]`} />
            <input type="number" min="0" step="0.01" value={recAmount} onChange={(e) => setRecAmount(e.target.value)} placeholder="Amount" className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-mono w-[110px] focus:outline-none focus:border-bf-accent/50" />
            <select value={recCat} onChange={(e) => setRecCat(e.target.value)} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bf-accent/50">
              <option value="">Category…</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
              ))}
            </select>
            <button onClick={addRecurring} className={btnPrimary}>Add</button>
          </div>
        </div>

        <div className="border-t border-white/[0.06] mt-4 pt-4">
          <button onClick={populateMonth} disabled={populating || !recurring.length} className={btnGhost}>
            {populating ? "Adding…" : "Add this month's recurring bills"}
          </button>
          {popMsg && <div className="text-xs text-bf-dim mt-2">{popMsg}</div>}
          <p className="text-[11px] text-bf-dim mt-2">One tap records every recurring bill for the current month — no duplicates.</p>
        </div>
      </div>
    </div>
  );
}

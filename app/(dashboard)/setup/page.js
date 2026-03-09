"use client";

import { useEffect, useState } from "react";
import {
  deleteCategory,
  deleteRecurring,
  getCategories,
  getProfile,
  getRecurring,
  insertRecurring,
  updateProfile,
  upsertCategory,
} from "../../lib/db";

export default function SetupPage() {
  const [profile, setProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [recurring, setRecurring] = useState([]);

  const [income, setIncome] = useState("");
  const [newCategory, setNewCategory] = useState({ name: "", slug: "", emoji: "📦", budget: "0", color: "#7CC5A8" });
  const [newRecurring, setNewRecurring] = useState({ description: "", amount: "", category_id: "" });

  const load = async () => {
    const [p, c, r] = await Promise.all([getProfile(), getCategories(), getRecurring()]);
    setProfile(p);
    setIncome(p?.monthly_income || "");
    setCategories(c || []);
    setRecurring(r || []);
    setNewRecurring((prev) => ({ ...prev, category_id: c?.[0]?.id || "" }));
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const saveIncome = async () => {
    const updated = await updateProfile({ monthly_income: Number(income || 0) });
    setProfile(updated);
  };

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.name || !newCategory.slug) return;

    const created = await upsertCategory({
      slug: newCategory.slug,
      name: newCategory.name,
      emoji: newCategory.emoji,
      budget: Number(newCategory.budget || 0),
      color: newCategory.color,
      sort_order: categories.length,
    });

    setCategories((prev) => [...prev.filter((c) => c.id !== created.id), created]);
    setNewCategory({ name: "", slug: "", emoji: "📦", budget: "0", color: "#7CC5A8" });
  };

  const removeCategory = async (id) => {
    if (!confirm("Delete category?")) return;
    await deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const addRecurring = async (e) => {
    e.preventDefault();
    if (!newRecurring.description || !newRecurring.amount || !newRecurring.category_id) return;

    const created = await insertRecurring({
      description: newRecurring.description,
      amount: Number(newRecurring.amount),
      category_id: newRecurring.category_id,
    });

    setRecurring((prev) => [...prev, created]);
    setNewRecurring({ description: "", amount: "", category_id: categories[0]?.id || "" });
  };

  const removeRecurringItem = async (id) => {
    if (!confirm("Delete recurring expense?")) return;
    await deleteRecurring(id);
    setRecurring((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="max-w-[980px] mx-auto px-5 py-6 grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
          <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono">Income</div>
          <div className="text-sm text-bf-dim mt-1">Monthly after-tax income</div>
          <div className="flex gap-2 mt-3">
            <input
              type="number"
              step="0.01"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm"
            />
            <button onClick={saveIncome} className="px-3 py-2 text-sm rounded-xl bg-bf-accent text-bf-bg font-semibold">Save</button>
          </div>
          {profile && <div className="text-xs text-bf-dim mt-2">Current: ${Number(profile.monthly_income || 0).toFixed(2)}</div>}
        </div>

        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
          <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono mb-2">Categories</div>

          <form onSubmit={addCategory} className="grid grid-cols-2 gap-2 mb-3">
            <input placeholder="Name" value={newCategory.name} onChange={(e) => setNewCategory((p) => ({ ...p, name: e.target.value }))} className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-sm" />
            <input placeholder="slug" value={newCategory.slug} onChange={(e) => setNewCategory((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-sm" />
            <input placeholder="Emoji" value={newCategory.emoji} onChange={(e) => setNewCategory((p) => ({ ...p, emoji: e.target.value }))} className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-sm" />
            <input placeholder="Budget" type="number" step="0.01" value={newCategory.budget} onChange={(e) => setNewCategory((p) => ({ ...p, budget: e.target.value }))} className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-sm" />
            <input type="color" value={newCategory.color} onChange={(e) => setNewCategory((p) => ({ ...p, color: e.target.value }))} className="h-9 bg-white/[0.04] border border-white/[0.07] rounded-lg px-1 py-1" />
            <button className="rounded-lg bg-bf-accent text-bf-bg text-sm font-semibold">Add Category</button>
          </form>

          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between border border-white/[0.07] rounded-xl p-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span>{c.emoji}</span>
                  <span>{c.name}</span>
                  <span className="text-xs text-bf-dim">({c.slug})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono">${Number(c.budget || 0).toFixed(2)}</span>
                  <button className="text-xs px-2 py-1 rounded-lg border border-bf-accent2/30 text-bf-accent2" onClick={() => removeCategory(c.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 h-fit">
        <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono mb-2">Recurring Expenses</div>

        <form onSubmit={addRecurring} className="grid grid-cols-1 gap-2 mb-3">
          <input placeholder="Description" value={newRecurring.description} onChange={(e) => setNewRecurring((p) => ({ ...p, description: e.target.value }))} className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-sm" />
          <input placeholder="Amount" type="number" step="0.01" value={newRecurring.amount} onChange={(e) => setNewRecurring((p) => ({ ...p, amount: e.target.value }))} className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-sm" />
          <select value={newRecurring.category_id} onChange={(e) => setNewRecurring((p) => ({ ...p, category_id: e.target.value }))} className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-sm">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
            ))}
          </select>
          <button className="rounded-lg bg-bf-accent text-bf-bg text-sm font-semibold py-1.5">Add Recurring</button>
        </form>

        <div className="space-y-2">
          {recurring.map((r) => (
            <div key={r.id} className="flex justify-between items-center border border-white/[0.07] rounded-xl p-2.5 text-sm">
              <div>
                <div>{r.description}</div>
                <div className="text-xs text-bf-dim">{r.categories?.name || "Uncategorized"}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono">${Number(r.amount || 0).toFixed(2)}</span>
                <button className="text-xs px-2 py-1 rounded-lg border border-bf-accent2/30 text-bf-accent2" onClick={() => removeRecurringItem(r.id)}>Delete</button>
              </div>
            </div>
          ))}
          {!recurring.length && <div className="text-sm text-bf-dim">No recurring expenses yet.</div>}
        </div>
      </div>
    </div>
  );
}

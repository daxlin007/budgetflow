"use client";

import { useState, useEffect } from "react";
import {
  getProfile, updateProfile,
  getCategories, upsertCategory, deleteCategory,
  getRecurring, insertRecurring, deleteRecurring,
} from "../../lib/db";

const PRESET_COLORS = [
  "#7CC5A8", "#E8927C", "#7CAFC5", "#C57CA8",
  "#C5B87C", "#A87CC5", "#7CC5C5", "#C57C7C",
  "#8FA87C", "#A8897C",
];
const PRESET_EMOJIS = ["🏠","🥑","⛽","🍽️","💡","📱","🚌","🎯","🛒","💊","🎬","🏋️","✈️","🐾","🎓","👗","🏦","🔧"];

const fmt = (n) => `$${Math.abs(parseFloat(n) || 0).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const labelCls = "text-[11px] text-bf-dim tracking-widest uppercase font-mono block mb-1";
const inputCls = "w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition";

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`fixed top-16 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg transition ${toast.type === "error" ? "bg-bf-accent2/20 border border-bf-accent2/30 text-bf-accent2" : "bg-bf-accent/20 border border-bf-accent/30 text-bf-accent"}`}>
      {toast.msg}
    </div>
  );
}

function CategoryForm({ cat, cats, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    id: cat?.id,
    slug: cat?.slug || "",
    name: cat?.name || "",
    emoji: cat?.emoji || "📦",
    budget: cat?.budget ? String(cat.budget) : "",
    color: cat?.color || "#7CC5A8",
    sort_order: cat?.sort_order ?? cats.length,
  });
  const [showEmojis, setShowEmojis] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const slug = form.slug.trim() || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    onSave({ ...form, slug, budget: parseFloat(form.budget) || 0 });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex gap-3">
        {/* Emoji picker */}
        <div className="relative">
          <label className={labelCls}>Icon</label>
          <button
            type="button"
            onClick={() => setShowEmojis(!showEmojis)}
            className="w-[52px] h-[48px] bg-white/[0.04] border border-white/[0.07] rounded-xl text-xl flex items-center justify-center cursor-pointer hover:bg-white/[0.08] transition"
          >
            {form.emoji}
          </button>
          {showEmojis && (
            <div className="absolute top-full left-0 z-10 mt-1 bg-bf-bg border border-white/[0.1] rounded-xl p-2 grid grid-cols-6 gap-1 shadow-xl">
              {PRESET_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { set("emoji", e); setShowEmojis(false); }}
                  className={`text-lg p-1 rounded-lg cursor-pointer hover:bg-white/[0.08] transition ${form.emoji === e ? "bg-bf-accent/10" : ""}`}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Name */}
        <div className="flex-1">
          <label className={labelCls}>Category Name</label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Groceries"
            required
            className={inputCls}
          />
        </div>

        {/* Budget */}
        <div className="w-28">
          <label className={labelCls}>Budget / mo</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-bf-dim font-mono text-sm">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.budget}
              onChange={(e) => set("budget", e.target.value)}
              placeholder="0"
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-6 pr-3 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition font-mono"
            />
          </div>
        </div>
      </div>

      {/* Color swatches */}
      <div>
        <label className={labelCls}>Color</label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set("color", c)}
              className="w-7 h-7 rounded-full cursor-pointer transition hover:scale-110"
              style={{ background: c, outline: form.color === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}
            />
          ))}
          <input
            type="color"
            value={form.color}
            onChange={(e) => set("color", e.target.value)}
            className="w-7 h-7 rounded-full cursor-pointer bg-transparent border-none"
            title="Custom color"
          />
        </div>
      </div>

      <div className="flex gap-2 mt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-transparent border border-white/[0.1] text-bf-dim text-sm cursor-pointer hover:bg-white/[0.05] transition">
          Cancel
        </button>
        <button type="submit" disabled={saving || !form.name.trim()} className="flex-1 py-2.5 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-sm font-bold cursor-pointer disabled:opacity-50 transition hover:opacity-90">
          {saving ? "Saving..." : (cat?.id ? "Save Changes" : "Add Category")}
        </button>
      </div>
    </form>
  );
}

function RecurringForm({ cats, onSave, onCancel, saving }) {
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [catId, setCatId] = useState(cats[0]?.id || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!desc.trim() || !amount || !catId) return;
    onSave({ description: desc.trim(), amount: parseFloat(amount), category_id: catId });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelCls}>Description</label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Netflix" required className={inputCls} />
        </div>
        <div className="w-28">
          <label className={labelCls}>Amount / mo</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-bf-dim font-mono text-sm">$</span>
            <input
              type="number" min="0" step="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0" required
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-6 pr-3 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition font-mono"
            />
          </div>
        </div>
      </div>
      <div>
        <label className={labelCls}>Category</label>
        <select value={catId} onChange={(e) => setCatId(e.target.value)} className="w-full bg-bf-bg border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition">
          {cats.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2 mt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-transparent border border-white/[0.1] text-bf-dim text-sm cursor-pointer hover:bg-white/[0.05] transition">Cancel</button>
        <button type="submit" disabled={saving || !desc.trim() || !amount} className="flex-1 py-2.5 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-sm font-bold cursor-pointer disabled:opacity-50 transition hover:opacity-90">
          {saving ? "Saving..." : "Add Recurring"}
        </button>
      </div>
    </form>
  );
}

export default function SetupPage() {
  const [profile, setProfile] = useState(null);
  const [cats, setCats] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");
  const [toast, setToast] = useState(null);

  // Profile
  const [income, setIncome] = useState("");
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Category editing
  const [editCat, setEditCat] = useState(null);
  const [addingCat, setAddingCat] = useState(false);
  const [savingCat, setSavingCat] = useState(false);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null);

  // Recurring
  const [addingRec, setAddingRec] = useState(false);
  const [savingRec, setSavingRec] = useState(false);
  const [confirmDeleteRec, setConfirmDeleteRec] = useState(null);

  useEffect(() => {
    Promise.all([getProfile(), getCategories(), getRecurring()])
      .then(([p, c, r]) => {
        setProfile(p);
        setIncome(p?.monthly_income ? String(p.monthly_income) : "");
        setName(p?.name || "");
        setCats(c || []);
        setRecurring(r || []);
        setLoading(false);
      })
      .catch((e) => { console.error(e); setLoading(false); });
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), monthly_income: parseFloat(income) || 0 });
      showToast("Profile saved!");
    } catch (e) {
      showToast(e.message || "Save failed.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveCat = async (catData) => {
    setSavingCat(true);
    try {
      const saved = await upsertCategory(catData);
      setCats((prev) => {
        const exists = prev.some((c) => c.id === saved.id);
        return exists ? prev.map((c) => c.id === saved.id ? saved : c) : [...prev, saved];
      });
      setEditCat(null);
      setAddingCat(false);
      showToast("Category saved!");
    } catch (e) {
      showToast(e.message || "Save failed.", "error");
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCat = async (id) => {
    try {
      await deleteCategory(id);
      setCats((prev) => prev.filter((c) => c.id !== id));
      setConfirmDeleteCat(null);
      showToast("Category deleted.");
    } catch (e) {
      showToast(e.message || "Delete failed.", "error");
    }
  };

  const handleSaveRec = async (recData) => {
    setSavingRec(true);
    try {
      const saved = await insertRecurring(recData);
      setRecurring((prev) => [...prev, saved]);
      setAddingRec(false);
      showToast("Recurring expense added!");
    } catch (e) {
      showToast(e.message || "Save failed.", "error");
    } finally {
      setSavingRec(false);
    }
  };

  const handleDeleteRec = async (id) => {
    try {
      await deleteRecurring(id);
      setRecurring((prev) => prev.filter((r) => r.id !== id));
      setConfirmDeleteRec(null);
      showToast("Recurring expense removed.");
    } catch (e) {
      showToast(e.message || "Delete failed.", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-bf-dim text-sm font-mono">Loading settings...</div>
      </div>
    );
  }

  const tabs = [
    { id: "profile", label: "Profile & Income" },
    { id: "categories", label: `Categories (${cats.length})` },
    { id: "recurring", label: `Recurring (${recurring.length})` },
  ];

  const totalBudget = cats.reduce((s, c) => s + parseFloat(c.budget || 0), 0);

  return (
    <div className="max-w-[680px] mx-auto px-5 py-6">
      <Toast toast={toast} />

      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium cursor-pointer transition ${activeTab === t.id ? "bg-bf-accent/10 border border-bf-accent/20 text-bf-accent" : "text-bf-dim hover:text-bf-text"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ─────────────────────────────────── */}
      {activeTab === "profile" && (
        <div className="flex flex-col gap-4">
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
            <h2 className="text-sm font-semibold mb-4 text-bf-dim uppercase tracking-widest font-mono">Personal Info</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className={labelCls}>Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Monthly Take-Home Income (after tax)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-bf-dim font-mono">$</span>
                  <input
                    type="number" min="0" step="0.01" value={income}
                    onChange={(e) => setIncome(e.target.value)}
                    placeholder="5500"
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-8 pr-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition font-mono"
                  />
                </div>
                <p className="text-[11px] text-bf-dim mt-1.5">Used to calculate your savings rate on the dashboard.</p>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="w-full py-3 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-sm font-bold cursor-pointer disabled:opacity-50 transition hover:opacity-90 mt-1"
              >
                {savingProfile ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CATEGORIES TAB ──────────────────────────────── */}
      {activeTab === "categories" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-bf-dim">Total budget: <span className="text-bf-text font-mono font-semibold">{fmt(totalBudget)}/mo</span></p>
            {!addingCat && !editCat && (
              <button
                onClick={() => setAddingCat(true)}
                className="text-sm text-bf-accent bg-bf-accent/[0.08] border border-bf-accent/[0.2] rounded-lg px-4 py-2 cursor-pointer hover:bg-bf-accent/[0.14] transition font-medium"
              >
                + Add Category
              </button>
            )}
          </div>

          {addingCat && (
            <CategoryForm cats={cats} onSave={handleSaveCat} onCancel={() => setAddingCat(false)} saving={savingCat} />
          )}

          {cats.length === 0 && !addingCat && (
            <div className="text-center py-12 text-bf-dim text-sm bg-white/[0.02] border border-white/[0.06] rounded-2xl">
              No categories yet. Add one above or complete the onboarding wizard.
            </div>
          )}

          {cats.map((cat) => (
            <div key={cat.id}>
              {editCat?.id === cat.id ? (
                <CategoryForm cat={editCat} cats={cats} onSave={handleSaveCat} onCancel={() => setEditCat(null)} saving={savingCat} />
              ) : (
                <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.07] rounded-2xl px-4 py-3.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${cat.color}20` }}>
                    {cat.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">{cat.name}</div>
                    <div className="text-[11px] text-bf-dim font-mono">{fmt(parseFloat(cat.budget))}/mo</div>
                  </div>
                  <div className="w-16 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: "100%", background: cat.color, opacity: 0.5 }} />
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => { setEditCat(cat); setAddingCat(false); }}
                      className="text-[11px] text-bf-dim hover:text-bf-text bg-white/[0.04] border border-white/[0.07] rounded-lg px-2.5 py-1.5 cursor-pointer transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDeleteCat(cat.id)}
                      className="text-[11px] text-bf-dim hover:text-bf-accent2 bg-white/[0.04] border border-white/[0.07] rounded-lg px-2.5 py-1.5 cursor-pointer transition"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── RECURRING TAB ───────────────────────────────── */}
      {activeTab === "recurring" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-bf-dim">Auto-populate at the start of each month.</p>
            {!addingRec && (
              <button
                onClick={() => setAddingRec(true)}
                disabled={cats.length === 0}
                className="text-sm text-bf-accent bg-bf-accent/[0.08] border border-bf-accent/[0.2] rounded-lg px-4 py-2 cursor-pointer hover:bg-bf-accent/[0.14] transition font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Add Recurring
              </button>
            )}
          </div>

          {cats.length === 0 && (
            <div className="text-center py-6 text-bf-dim text-sm bg-bf-accent2/[0.04] border border-bf-accent2/[0.15] rounded-2xl">
              Add categories first before setting up recurring expenses.
            </div>
          )}

          {addingRec && cats.length > 0 && (
            <RecurringForm cats={cats} onSave={handleSaveRec} onCancel={() => setAddingRec(false)} saving={savingRec} />
          )}

          {recurring.length === 0 && !addingRec && cats.length > 0 && (
            <div className="text-center py-12 text-bf-dim text-sm bg-white/[0.02] border border-white/[0.06] rounded-2xl">
              No recurring expenses yet. Add bills that repeat every month.
            </div>
          )}

          {recurring.map((rec) => {
            const cat = cats.find((c) => c.id === rec.category_id);
            return (
              <div key={rec.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.07] rounded-2xl px-4 py-3.5">
                <span className="text-lg flex-shrink-0">{cat?.emoji || "📦"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium">{rec.description}</div>
                  <div className="text-[11px] text-bf-dim">{cat?.name || "Uncategorized"}</div>
                </div>
                <div className="text-[13px] font-mono font-semibold text-bf-accent2 flex-shrink-0">
                  {fmt(parseFloat(rec.amount))}/mo
                </div>
                <span className="text-[10px] text-bf-accent font-mono bg-bf-accent/[0.08] border border-bf-accent/[0.15] rounded-md px-1.5 py-0.5 flex-shrink-0">↻</span>
                <button
                  onClick={() => setConfirmDeleteRec(rec.id)}
                  className="text-[11px] text-bf-dim hover:text-bf-accent2 bg-white/[0.04] border border-white/[0.07] rounded-lg px-2.5 py-1.5 cursor-pointer transition flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Category Confirm */}
      {confirmDeleteCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setConfirmDeleteCat(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-[340px] bg-bf-bg border border-white/[0.1] rounded-2xl p-6 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-3xl mb-3">⚠️</div>
            <h3 className="text-lg font-bold mb-2">Delete category?</h3>
            <p className="text-bf-dim text-sm mb-6">Transactions in this category will become uncategorized. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteCat(null)} className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/[0.07] text-bf-dim text-sm cursor-pointer hover:bg-white/[0.07] transition">Cancel</button>
              <button onClick={() => handleDeleteCat(confirmDeleteCat)} className="flex-1 py-3 rounded-xl bg-bf-accent2/20 border border-bf-accent2/30 text-bf-accent2 text-sm font-bold cursor-pointer hover:bg-bf-accent2/30 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Recurring Confirm */}
      {confirmDeleteRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setConfirmDeleteRec(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-[340px] bg-bf-bg border border-white/[0.1] rounded-2xl p-6 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-3xl mb-3">🗑️</div>
            <h3 className="text-lg font-bold mb-2">Remove recurring expense?</h3>
            <p className="text-bf-dim text-sm mb-6">It will no longer auto-populate next month. Past transactions are unaffected.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteRec(null)} className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/[0.07] text-bf-dim text-sm cursor-pointer hover:bg-white/[0.07] transition">Cancel</button>
              <button onClick={() => handleDeleteRec(confirmDeleteRec)} className="flex-1 py-3 rounded-xl bg-bf-accent2/20 border border-bf-accent2/30 text-bf-accent2 text-sm font-bold cursor-pointer hover:bg-bf-accent2/30 transition">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

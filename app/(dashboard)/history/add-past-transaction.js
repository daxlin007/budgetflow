"use client";

import { useState } from "react";
import { insertTransaction } from "../../lib/db";
import { formatCurrency } from "../../lib/currency";

const labelCls = "text-[11px] text-bf-dim tracking-widest uppercase font-mono block mb-1";
const inputCls = "w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition";

export default function AddPastTransaction({ cats, currency = "USD", onAdded, onClose }) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState(cats[0]?.id || "");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!desc.trim()) {
      setError("Description is required");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    if (!category) {
      setError("Please select a category");
      return;
    }
    if (!date) {
      setError("Please select a date");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const tx = await insertTransaction({
        category_id: category,
        description: desc.trim(),
        amount: parseFloat(amount),
        date: date,
      });
      onAdded(tx);
      // Reset form
      setDate(new Date().toISOString().split("T")[0]);
      setCategory(cats[0]?.id || "");
      setDesc("");
      setAmount("");
    } catch (e) {
      setError(e.message || "Failed to add transaction");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bf-bg border border-white/[0.1] rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-lg font-bold mb-4">Add Transaction</h2>

        <div className="flex flex-col gap-4">
          {/* Date */}
          <div>
            <label className={labelCls}>Transaction Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Category */}
          <div>
            <label className={labelCls}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              <option value="">Select a category</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <input
              type="text"
              placeholder="e.g., Groceries at Whole Foods"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Amount */}
          <div>
            <label className={labelCls}>Amount</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputCls}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-bf-dim font-mono text-sm">
                {currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "JPY" ? "¥" : currency === "CAD" ? "$" : "¤"}
              </span>
            </div>
          </div>

          {error && (
            <div className="text-sm text-bf-accent2 px-3 py-2 bg-bf-accent2/[0.08] rounded-lg border border-bf-accent2/[0.15]">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/[0.07] text-bf-dim text-sm cursor-pointer hover:bg-white/[0.07] transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-sm font-bold cursor-pointer disabled:opacity-50 transition hover:opacity-90"
            >
              {saving ? "Adding..." : "Add Transaction"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

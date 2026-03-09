"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deleteTransaction,
  getCategories,
  getTransactions,
  updateTransaction,
} from "../../lib/db";

const nowKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function HistoryPage() {
  const [month, setMonth] = useState(nowKey());
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const load = async (mk) => {
    const [cats, txs] = await Promise.all([getCategories(), getTransactions(mk)]);
    setCategories(cats || []);
    setTransactions(txs || []);
  };

  useEffect(() => {
    setLoading(true);
    load(month)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [month]);

  const total = useMemo(
    () => transactions.reduce((s, t) => s + Number(t.amount || 0), 0),
    [transactions]
  );

  const startEdit = (tx) => {
    setEditing(tx.id);
    setForm({
      amount: tx.amount,
      description: tx.description,
      date: tx.date,
      category_id: tx.category_id,
    });
  };

  const saveEdit = async (id) => {
    const updated = await updateTransaction(id, {
      amount: Number(form.amount || 0),
      description: form.description,
      date: form.date,
      category_id: form.category_id,
    });

    setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setEditing(null);
    setForm({});
  };

  const remove = async (id) => {
    if (!confirm("Delete this transaction?")) return;
    await deleteTransaction(id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="max-w-[900px] mx-auto px-5 py-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono">History</div>
          <h1 className="text-2xl font-bold">Transactions</h1>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 mb-4">
        <div className="text-sm text-bf-dim">Total for selected month</div>
        <div className="text-2xl font-bold mt-1">{fmt(total)}</div>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
        {loading ? (
          <div className="text-sm text-bf-dim">Loading…</div>
        ) : transactions.length === 0 ? (
          <div className="text-sm text-bf-dim">No transactions in this month.</div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="border border-white/[0.07] rounded-xl p-3">
                {editing === tx.id ? (
                  <div className="grid gap-2 md:grid-cols-4">
                    <input
                      className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-sm"
                      value={form.description || ""}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-sm"
                      value={form.amount || ""}
                      onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    />
                    <input
                      type="date"
                      className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-sm"
                      value={form.date || ""}
                      onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    />
                    <select
                      className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-sm"
                      value={form.category_id || ""}
                      onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                      ))}
                    </select>
                    <div className="md:col-span-4 flex gap-2 justify-end">
                      <button className="px-3 py-1.5 text-sm rounded-lg border border-white/[0.12]" onClick={() => setEditing(null)}>Cancel</button>
                      <button className="px-3 py-1.5 text-sm rounded-lg bg-bf-accent text-bf-bg font-semibold" onClick={() => saveEdit(tx.id)}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{tx.description}</div>
                      <div className="text-xs text-bf-dim">{tx.date}</div>
                    </div>
                    <div className="font-mono text-sm">{fmt(tx.amount)}</div>
                    <button className="text-xs px-2 py-1 rounded-lg border border-white/[0.12]" onClick={() => startEdit(tx)}>Edit</button>
                    <button className="text-xs px-2 py-1 rounded-lg border border-bf-accent2/30 text-bf-accent2" onClick={() => remove(tx.id)}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

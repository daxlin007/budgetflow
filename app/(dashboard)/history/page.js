"use client";

import { useState, useEffect } from "react";
import {
  getCategories,
  getTransactions,
  updateTransaction,
  deleteTransaction,
} from "../../lib/db";

const nowKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const mkLabel = (k) => {
  const [y, m] = k.split("-");
  return new Date(+y, +m - 1).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  });
};
const shiftMk = (k, delta) => {
  const [y, m] = k.split("-").map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};
const fmt = (n) =>
  `$${Math.abs(n).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function HistoryPage() {
  const [cats, setCats] = useState([]);
  const [txs, setTxs] = useState([]);
  const [selMonth, setSelMonth] = useState(nowKey());
  const [loading, setLoading] = useState(true);

  // Edit state — stored in component state, never inside render
  const [editingTx, setEditingTx] = useState(null);
  const [saving, setSaving] = useState(false);

  const mk = nowKey();

  useEffect(() => {
    setLoading(true);
    Promise.all([getCategories(), getTransactions(selMonth)])
      .then(([c, t]) => {
        setCats(c || []);
        setTxs(t || []);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, [selMonth]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm("Delete this transaction?")) return;
    try {
      await deleteTransaction(id);
      setTxs((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (tx) => {
    setEditingTx({
      id: tx.id,
      description: tx.description,
      amount: String(tx.amount),
      category_id: tx.category_id || "",
      date: tx.date,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTx) return;
    const amount = parseFloat(editingTx.amount);
    if (isNaN(amount) || amount <= 0) return;
    setSaving(true);
    try {
      const updated = await updateTransaction(editingTx.id, {
        description: editingTx.description,
        amount,
        category_id: editingTx.category_id || null,
        date: editingTx.date,
      });
      setTxs((prev) =>
        prev.map((t) => (t.id === editingTx.id ? { ...t, ...updated } : t))
      );
      setEditingTx(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const handleCSV = () => {
    const headers = ["Date", "Description", "Category", "Amount"];
    const rows = txs.map((tx) => {
      const cat = cats.find((c) => c.id === tx.category_id);
      return [
        tx.date,
        `"${tx.description.replace(/"/g, '""')}"`,
        `"${(cat?.name || "Uncategorized").replace(/"/g, '""')}"`,
        tx.amount,
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budgetflow-${selMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const arrowCls =
    "bg-white/[0.05] border border-white/[0.07] rounded-lg px-3 py-1.5 cursor-pointer text-bf-dim text-sm hover:bg-white/[0.08] transition";

  const totalSpent = txs.reduce((s, t) => s + parseFloat(t.amount), 0);

  return (
    <div className="max-w-[780px] mx-auto px-5 py-6">
      {/* Month Navigator */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setSelMonth(shiftMk(selMonth, -1))}
          className={arrowCls}
        >
          ◂
        </button>
        <div className="flex-1 text-center">
          <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono">
            {selMonth === mk ? "Current Month" : "Viewing"}
          </div>
          <h1 className="text-2xl font-bold mt-0.5">{mkLabel(selMonth)}</h1>
          {selMonth !== mk && (
            <button
              onClick={() => setSelMonth(mk)}
              className="text-xs text-bf-accent bg-transparent border-none cursor-pointer mt-0.5"
            >
              Jump to current →
            </button>
          )}
        </div>
        <button
          onClick={() => {
            if (selMonth < mk) setSelMonth(shiftMk(selMonth, 1));
          }}
          className={arrowCls}
          style={{ opacity: selMonth >= mk ? 0.25 : 1 }}
        >
          ▸
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center mb-3">
        <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono">
          {txs.length} transaction{txs.length !== 1 ? "s" : ""} · {fmt(totalSpent)} total
        </div>
        {txs.length > 0 && (
          <button
            onClick={handleCSV}
            className="text-xs text-bf-accent bg-bf-accent/[0.08] border border-bf-accent/[0.18] rounded-lg px-3 py-1.5 cursor-pointer hover:bg-bf-accent/[0.14] transition"
          >
            ↓ Export CSV
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-bf-dim text-sm font-mono">
          Loading...
        </div>
      ) : txs.length === 0 ? (
        <div className="text-center py-12 text-bf-dim text-sm">
          No transactions for {mkLabel(selMonth)}.
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
          {txs.map((tx, i) => {
            const cat = cats.find((c) => c.id === tx.category_id);
            return (
              <div
                key={tx.id}
                className={`flex items-center px-5 py-3 gap-3 ${
                  i < txs.length - 1 ? "border-b border-white/[0.04]" : ""
                }`}
              >
                <span className="text-lg">{cat?.emoji || "📦"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">
                    {tx.description}
                    {tx.is_recurring && (
                      <span className="text-[9px] text-bf-accent ml-1.5 font-mono">
                        ↻
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-bf-dim">
                    {tx.date} · {cat?.name || "Uncategorized"}
                  </div>
                </div>
                <span className="text-[13px] font-semibold font-mono text-bf-accent2 mr-2">
                  -{fmt(parseFloat(tx.amount))}
                </span>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => openEdit(tx)}
                    className="text-[11px] text-bf-dim border border-white/[0.08] rounded-md px-2 py-1 hover:text-bf-text hover:border-white/[0.15] transition cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="text-[11px] text-bf-accent2/60 border border-white/[0.08] rounded-md px-2 py-1 hover:text-bf-accent2 hover:border-bf-accent2/30 transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-bf-surface border border-white/[0.1] rounded-2xl p-6 w-full max-w-[400px]">
            <h3 className="text-base font-bold mb-4">Edit Transaction</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] text-bf-dim tracking-widest uppercase font-mono block mb-1">
                  Description
                </label>
                <input
                  value={editingTx.description}
                  onChange={(e) =>
                    setEditingTx((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-bf-text outline-none focus:border-bf-accent/30 transition"
                />
              </div>
              <div>
                <label className="text-[10px] text-bf-dim tracking-widest uppercase font-mono block mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingTx.amount}
                  onChange={(e) =>
                    setEditingTx((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-bf-text outline-none focus:border-bf-accent/30 transition"
                />
              </div>
              <div>
                <label className="text-[10px] text-bf-dim tracking-widest uppercase font-mono block mb-1">
                  Category
                </label>
                <select
                  value={editingTx.category_id}
                  onChange={(e) =>
                    setEditingTx((prev) => ({
                      ...prev,
                      category_id: e.target.value,
                    }))
                  }
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-bf-text outline-none focus:border-bf-accent/30 transition"
                >
                  <option value="">Uncategorized</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-bf-dim tracking-widest uppercase font-mono block mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={editingTx.date}
                  onChange={(e) =>
                    setEditingTx((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-bf-text outline-none focus:border-bf-accent/30 transition"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setEditingTx(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.1] text-sm text-bf-dim hover:text-bf-text transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-bf-accent/[0.15] border border-bf-accent/[0.25] text-bf-accent text-sm font-semibold disabled:opacity-40 hover:bg-bf-accent/[0.22] transition cursor-pointer"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { getCategories, getAllTransactions, updateTransaction, deleteTransaction } from "../../lib/db";

const fmt = (n) => `$${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nowKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const mkLabel = (k) => { const [y, m] = k.split("-"); return new Date(+y, +m - 1).toLocaleDateString("en-CA", { month: "long", year: "numeric" }); };
const shiftMk = (k, d) => { const [y, m] = k.split("-").map(Number); const dt = new Date(y, m - 1 + d, 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; };

const inputCls = "bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-bf-text text-sm outline-none focus:border-bf-accent/30 transition";
const arrowCls = "bg-white/[0.05] border border-white/[0.07] rounded-lg px-3 py-1.5 cursor-pointer text-bf-dim text-sm hover:bg-white/[0.08] transition";

export default function HistoryPage() {
  const [cats, setCats] = useState([]);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selMonth, setSelMonth] = useState(nowKey());
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [editTx, setEditTx] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // id or "bulk"
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const mk = nowKey();

  useEffect(() => {
    Promise.all([getCategories(), getAllTransactions()])
      .then(([c, t]) => { setCats(c || []); setTxs(t || []); setLoading(false); })
      .catch((e) => { console.error(e); setLoading(false); });
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Filter transactions
  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (!t || !t.id) return false;
      if (!t.date || !t.date.startsWith(selMonth)) return false;
      if (filterCat !== "all" && t.category_id !== filterCat) return false;
      if (search && !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [txs, selMonth, filterCat, search]);

  const totalSpent = filtered.reduce((s, t) => s + parseFloat(t.amount), 0);

  // Selection
  const allSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t) => t.id)));
    }
  };
  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Delete single
  const handleDeleteOne = async (id) => {
    setDeleting(true);
    try {
      await deleteTransaction(id);
      setTxs((prev) => prev.filter((t) => t.id !== id));
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      showToast("Transaction deleted.");
    } catch (e) {
      showToast(e.message || "Delete failed.", "error");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      await Promise.all([...selected].map((id) => deleteTransaction(id)));
      setTxs((prev) => prev.filter((t) => !selected.has(t.id)));
      const count = selected.size;
      setSelected(new Set());
      showToast(`${count} transaction${count > 1 ? "s" : ""} deleted.`);
    } catch (e) {
      showToast(e.message || "Delete failed.", "error");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  // Edit save
  const handleSaveEdit = async () => {
    if (!editTx) return;
    setSaving(true);
    try {
      const updated = await updateTransaction(editTx.id, {
        description: editTx.description,
        amount: parseFloat(editTx.amount),
        date: editTx.date,
        category_id: editTx.category_id,
      });
      setTxs((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      setEditTx(null);
      showToast("Transaction updated.");
    } catch (e) {
      showToast(e.message || "Update failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  // CSV export
  const handleExportCSV = () => {
    const rows = [
      ["Date", "Description", "Category", "Amount", "Recurring"],
      ...filtered.map((t) => {
        const cat = cats.find((c) => c.id === t.category_id);
        return [
          t.date,
          `"${t.description.replace(/"/g, '""')}"`,
          cat?.name || "Uncategorized",
          t.amount,
          t.is_recurring ? "Yes" : "No",
        ];
      }),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budgetflow-${selMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-bf-dim text-sm font-mono">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="max-w-[780px] mx-auto px-5 py-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg transition ${toast.type === "error" ? "bg-bf-accent2/20 border border-bf-accent2/30 text-bf-accent2" : "bg-bf-accent/20 border border-bf-accent/30 text-bf-accent"}`}>
          {toast.msg}
        </div>
      )}

      {/* Month Navigator */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => { setSelected(new Set()); setSelMonth(shiftMk(selMonth, -1)); }} className={arrowCls}>◂</button>
        <div className="flex-1 text-center">
          <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono">{selMonth === mk ? "Current Month" : "Viewing"}</div>
          <h1 className="text-2xl font-bold mt-0.5">{mkLabel(selMonth)}</h1>
          {selMonth !== mk && <button onClick={() => { setSelected(new Set()); setSelMonth(mk); }} className="text-xs text-bf-accent bg-transparent border-none cursor-pointer mt-0.5">Jump to current →</button>}
        </div>
        <button onClick={() => { if (selMonth < mk) { setSelected(new Set()); setSelMonth(shiftMk(selMonth, 1)); } }} className={arrowCls} style={{ opacity: selMonth >= mk ? 0.25 : 1 }}>▸</button>
      </div>

      {/* Search + Filter + Export */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transactions..."
          className={`flex-1 min-w-[160px] ${inputCls}`}
        />
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className={`${inputCls} bg-bf-bg`}
        >
          <option value="all">All Categories</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
          ))}
        </select>
        <button
          onClick={handleExportCSV}
          disabled={filtered.length === 0}
          className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-bf-dim text-sm hover:bg-white/[0.08] hover:text-bf-text transition disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Summary + Bulk actions bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] text-bf-dim font-mono">
          {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
          {filtered.length > 0 && <> · <span className="text-bf-accent2">{fmt(totalSpent)}</span> total</>}
        </div>
        {selected.size > 0 && (
          <button
            onClick={() => setConfirmDelete("bulk")}
            className="text-xs text-bf-accent2 bg-bf-accent2/[0.08] border border-bf-accent2/[0.2] rounded-lg px-3 py-1.5 cursor-pointer hover:bg-bf-accent2/[0.15] transition"
          >
            Delete {selected.size} selected
          </button>
        )}
      </div>

      {/* Transaction List */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-bf-dim text-sm">
            {search || filterCat !== "all" ? "No transactions match your filters." : selMonth === mk ? "💬 No transactions yet. Chat your expenses in the Budget tab!" : "📭 No transactions for this month."}
          </div>
        ) : (
          <>
            {/* Header row */}
            <div className="flex items-center px-4 py-2.5 border-b border-white/[0.05] bg-white/[0.02]">
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center mr-3 cursor-pointer flex-shrink-0 ${allSelected ? "bg-bf-accent border-bf-accent" : "border-white/[0.2]"}`}
                onClick={toggleAll}
              >
                {allSelected && <span className="text-[9px] text-bf-bg font-bold">✓</span>}
              </div>
              <span className="text-[10px] text-bf-dim font-mono tracking-widest uppercase flex-1">Description</span>
              <span className="text-[10px] text-bf-dim font-mono tracking-widest uppercase w-24 text-right hidden sm:block">Date</span>
              <span className="text-[10px] text-bf-dim font-mono tracking-widest uppercase w-24 text-right">Amount</span>
              <span className="w-16" />
            </div>

            {filtered.map((tx) => {
              const cat = cats.find((c) => c.id === tx.category_id);
              const isSelected = selected.has(tx.id);
              return (
                <div
                  key={tx.id}
                  className={`flex items-center px-4 py-3 border-b border-white/[0.04] last:border-0 transition ${isSelected ? "bg-bf-accent/[0.04]" : "hover:bg-white/[0.02]"}`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center mr-3 cursor-pointer flex-shrink-0 ${isSelected ? "bg-bf-accent border-bf-accent" : "border-white/[0.2]"}`}
                    onClick={() => toggleOne(tx.id)}
                  >
                    {isSelected && <span className="text-[9px] text-bf-bg font-bold">✓</span>}
                  </div>
                  <span className="text-base mr-2.5 flex-shrink-0">{cat?.emoji || "📦"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] truncate">
                      {tx.description}
                      {tx.is_recurring && <span className="text-[9px] text-bf-accent ml-1.5 font-mono">↻</span>}
                    </div>
                    <div className="text-[10px] text-bf-dim">{cat?.name || "Uncategorized"}</div>
                  </div>
                  <span className="text-[12px] text-bf-dim font-mono w-24 text-right hidden sm:block">{tx.date}</span>
                  <span className="text-[13px] font-semibold text-bf-accent2 font-mono w-24 text-right">-{fmt(parseFloat(tx.amount))}</span>
                  <div className="flex gap-1 ml-2 w-16 justify-end">
                    <button
                      onClick={() => setEditTx({ ...tx, amount: String(tx.amount) })}
                      className="text-[11px] text-bf-dim hover:text-bf-text bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1 cursor-pointer transition"
                      title="Edit"
                    >
                      ✏
                    </button>
                    <button
                      onClick={() => setConfirmDelete(tx.id)}
                      className="text-[11px] text-bf-dim hover:text-bf-accent2 bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1 cursor-pointer transition"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setEditTx(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-[400px] bg-bf-bg border border-white/[0.1] rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5">Edit Transaction</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] text-bf-dim tracking-widest uppercase font-mono block mb-1">Description</label>
                <input
                  value={editTx.description}
                  onChange={(e) => setEditTx((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] text-bf-dim tracking-widest uppercase font-mono block mb-1">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editTx.amount}
                    onChange={(e) => setEditTx((p) => ({ ...p, amount: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition font-mono"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-bf-dim tracking-widest uppercase font-mono block mb-1">Date</label>
                  <input
                    type="date"
                    value={editTx.date}
                    onChange={(e) => setEditTx((p) => ({ ...p, date: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-bf-dim tracking-widest uppercase font-mono block mb-1">Category</label>
                <select
                  value={editTx.category_id || ""}
                  onChange={(e) => setEditTx((p) => ({ ...p, category_id: e.target.value }))}
                  className="w-full bg-bf-bg border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text outline-none focus:border-bf-accent/30 transition"
                >
                  <option value="">Uncategorized</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditTx(null)} className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/[0.07] text-bf-dim text-sm cursor-pointer hover:bg-white/[0.07] transition">Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving} className="flex-1 py-3 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-sm font-bold cursor-pointer disabled:opacity-50 transition hover:opacity-90">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setConfirmDelete(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-[360px] bg-bf-bg border border-white/[0.1] rounded-2xl p-6 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-3xl mb-3">🗑️</div>
            <h3 className="text-lg font-bold mb-2">
              {confirmDelete === "bulk" ? `Delete ${selected.size} transactions?` : "Delete transaction?"}
            </h3>
            <p className="text-bf-dim text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/[0.07] text-bf-dim text-sm cursor-pointer hover:bg-white/[0.07] transition">Cancel</button>
              <button
                onClick={() => confirmDelete === "bulk" ? handleBulkDelete() : handleDeleteOne(confirmDelete)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-bf-accent2/20 border border-bf-accent2/30 text-bf-accent2 text-sm font-bold cursor-pointer disabled:opacity-50 hover:bg-bf-accent2/30 transition"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

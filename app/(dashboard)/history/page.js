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
  return new Date(+y, +m - 1).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
};
const shiftMk = (k, d) => {
  const [y, m] = k.split("-").map(Number);
  const dt = new Date(y, m - 1 + d, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
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
  "bg-transparent border border-bf-accent2/30 text-bf-accent2 rounded-lg px-3 py-2 text-sm hover:bg-bf-accent2/10 transition";
const arrowCls =
  "bg-white/[0.05] border border-white/[0.07] rounded-lg px-3 py-1.5 cursor-pointer text-bf-dim text-sm hover:bg-white/[0.08] transition";

function toCSV(txs, cats) {
  const catName = (id) => cats.find((c) => c.id === id)?.name || "";
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Date", "Description", "Category", "Amount"]];
  txs.forEach((t) =>
    rows.push([t.date, t.description, catName(t.category_id), parseFloat(t.amount).toFixed(2)])
  );
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

export default function HistoryPage() {
  const [cats, setCats] = useState([]);
  const [txs, setTxs] = useState([]);
  const [selMonth, setSelMonth] = useState(nowKey());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // {id, description, amount, date, category_id}
  const [saving, setSaving] = useState(false);

  const mk = nowKey();

  useEffect(() => {
    getCategories().then((c) => setCats(c || [])).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    getTransactions(selMonth)
      .then((t) => {
        setTxs(t || []);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, [selMonth]);

  const filtered = txs.filter((t) =>
    search.trim()
      ? t.description.toLowerCase().includes(search.trim().toLowerCase())
      : true
  );
  const total = filtered.reduce((s, t) => s + parseFloat(t.amount), 0);

  function openEdit(tx) {
    setEditing({
      id: tx.id,
      description: tx.description,
      amount: parseFloat(tx.amount),
      date: tx.date,
      category_id: tx.category_id || "",
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await updateTransaction(editing.id, {
        description: editing.description,
        amount: editing.amount,
        date: editing.date,
        category_id: editing.category_id || null,
      });
      setTxs((prev) =>
        prev.map((t) =>
          t.id === editing.id
            ? { ...t, description: editing.description, amount: editing.amount, date: editing.date, category_id: editing.category_id }
            : t
        )
      );
      setEditing(null);
    } catch (e) {
      console.error(e);
      alert("Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTx(id) {
    if (!window.confirm("Delete this transaction?")) return;
    try {
      await deleteTransaction(id);
      setTxs((prev) => prev.filter((t) => t.id !== id));
      setEditing(null);
    } catch (e) {
      console.error(e);
      alert("Couldn't delete — try again.");
    }
  }

  function exportCSV() {
    const csv = toCSV(filtered, cats);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budgetflow-${selMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const catOf = (id) => cats.find((c) => c.id === id);

  return (
    <div className="max-w-[780px] mx-auto px-5 py-6">
      {/* Month navigator */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => setSelMonth(shiftMk(selMonth, -1))} className={arrowCls}>◂</button>
        <div className="flex-1 text-center">
          <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono">
            {selMonth === mk ? "Current Month" : "Viewing"}
          </div>
          <h1 className="text-2xl font-bold mt-0.5">{mkLabel(selMonth)}</h1>
        </div>
        <button
          onClick={() => { if (selMonth < mk) setSelMonth(shiftMk(selMonth, 1)); }}
          className={arrowCls}
          style={{ opacity: selMonth >= mk ? 0.25 : 1 }}
        >▸</button>
      </div>

      {/* Search + export */}
      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search descriptions…"
          className={inputCls}
        />
        <button onClick={exportCSV} disabled={!filtered.length} className={btnGhost}>
          Export CSV
        </button>
      </div>

      {/* List */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
        <div className="flex justify-between items-center mb-3">
          <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono">
            {filtered.length} transaction{filtered.length === 1 ? "" : "s"}
          </div>
          <div className="text-sm font-mono font-bold">{fmt(total)}</div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-bf-dim text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-bf-dim text-sm">📭 No transactions{search ? " match your search." : "."}</div>
        ) : (
          filtered.map((tx) => {
            const cat = catOf(tx.category_id);
            return (
              <button
                key={tx.id}
                onClick={() => openEdit(tx)}
                className="w-full flex items-center py-2.5 border-b border-white/[0.04] text-left hover:bg-white/[0.02] transition rounded px-1"
              >
                <span className="text-base mr-2.5">{cat?.emoji || "📦"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] truncate">
                    {tx.description}
                    {tx.is_recurring && <span className="text-[9px] text-bf-accent ml-1.5 font-mono">↻</span>}
                  </div>
                  <div className="text-[10px] text-bf-dim">
                    {tx.date} · {cat?.name || "Uncategorized"}
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-bf-accent2 font-mono">-{fmt(parseFloat(tx.amount))}</span>
              </button>
            );
          })
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setEditing(null)}>
          <div className="bg-bf-surface border border-white/[0.08] rounded-2xl p-6 w-full max-w-[420px] animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Edit transaction</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] text-bf-dim tracking-widest uppercase font-mono">Description</label>
                <input
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className={`${inputCls} mt-1`}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] text-bf-dim tracking-widest uppercase font-mono">Amount</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={editing.amount}
                    onChange={(e) => setEditing({ ...editing, amount: parseFloat(e.target.value) || 0 })}
                    className={`${inputCls} mt-1 font-mono`}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-bf-dim tracking-widest uppercase font-mono">Date</label>
                  <input
                    type="date"
                    value={editing.date}
                    onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                    className={`${inputCls} mt-1`}
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-bf-dim tracking-widest uppercase font-mono">Category</label>
                <select
                  value={editing.category_id}
                  onChange={(e) => setEditing({ ...editing, category_id: e.target.value })}
                  className={`${inputCls} mt-1`}
                >
                  <option value="">Uncategorized</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={saveEdit} disabled={saving} className={btnPrimary}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditing(null)} className={btnGhost}>Cancel</button>
              <button onClick={() => removeTx(editing.id)} className={`${btnDanger} ml-auto`}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

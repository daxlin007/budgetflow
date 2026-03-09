"use client";

import { useEffect, useMemo, useState } from "react";
import { getCategories, getTransactions, insertTransaction } from "../../lib/db";

const monthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const fmt = (n) =>
  `$${Math.abs(Number(n || 0)).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function BudgetPage() {
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([
    { role: "assistant", text: 'Try: "Spent $45 groceries and $20 gas"' },
  ]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadData = async () => {
    const mk = monthKey();
    const [cats, txs] = await Promise.all([getCategories(), getTransactions(mk)]);
    setCategories(cats || []);
    setTransactions(txs || []);
  };

  useEffect(() => {
    loadData()
      .catch((e) => {
        console.error(e);
        setChat((prev) => [...prev, { role: "assistant", text: "Could not load budget data." }]);
      })
      .finally(() => setLoading(false));
  }, []);

  const budgetContext = useMemo(() => {
    const spendByCategory = {};
    transactions.forEach((tx) => {
      spendByCategory[tx.category_id] =
        (spendByCategory[tx.category_id] || 0) + Number(tx.amount || 0);
    });

    const lines = categories.map((c) => {
      const spent = spendByCategory[c.id] || 0;
      return `${c.name}: spent ${fmt(spent)} of ${fmt(c.budget || 0)}`;
    });

    return lines.join("\n");
  }, [categories, transactions]);

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setMessage("");
    setChat((prev) => [...prev, { role: "user", text: trimmed }]);

    try {
      const res = await fetch("/api/parse-spending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          categories,
          budgetContext,
        }),
      });

      const parsed = await res.json();

      if (parsed.type === "transaction") {
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        if (!items.length) {
          setChat((prev) => [...prev, { role: "assistant", text: "I couldn't find any amounts in that message." }]);
          return;
        }

        const created = [];
        for (const item of items) {
          const cat = categories.find((c) => c.slug === item.category_slug) || categories[0];
          if (!cat) continue;

          const tx = await insertTransaction({
            category_id: cat.id,
            amount: Number(item.amount || 0),
            description: item.description || cat.name,
            date: new Date().toISOString().slice(0, 10),
            original_message: trimmed,
          });

          created.push(tx);
        }

        setTransactions((prev) => [...created, ...prev]);
        setChat((prev) => [
          ...prev,
          {
            role: "assistant",
            text: created.length
              ? `Added ${created.length} transaction${created.length > 1 ? "s" : ""}.`
              : "I couldn't map that to your categories.",
          },
        ]);
      } else {
        setChat((prev) => [...prev, { role: "assistant", text: parsed.message || "Got it." }]);
      }
    } catch (err) {
      console.error(err);
      setChat((prev) => [...prev, { role: "assistant", text: "Something went wrong while parsing that message." }]);
    } finally {
      setSending(false);
    }
  };

  const spent = transactions.reduce((s, t) => s + Number(t.amount || 0), 0);
  const budget = categories.reduce((s, c) => s + Number(c.budget || 0), 0);

  if (loading) {
    return <div className="p-6 text-sm text-bf-dim">Loading chat…</div>;
  }

  return (
    <div className="max-w-[950px] mx-auto px-5 py-6 grid gap-4 md:grid-cols-[1.4fr_1fr]">
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 flex flex-col h-[70vh]">
        <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono mb-3">Budget Chat</div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {chat.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={`max-w-[88%] px-3 py-2 rounded-xl text-sm ${
                m.role === "user"
                  ? "ml-auto bg-bf-accent/15 border border-bf-accent/25"
                  : "bg-white/[0.03] border border-white/[0.07]"
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>

        <form onSubmit={handleSend} className="mt-3 flex gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='e.g. "Spent $40 on groceries and $15 coffee"'
            className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-bf-accent/30"
          />
          <button
            type="submit"
            disabled={sending || categories.length === 0}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-sm font-bold disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
          <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono">This Month</div>
          <div className="text-2xl font-bold mt-2">{fmt(spent)}</div>
          <div className="text-xs text-bf-dim mt-1">Budget {fmt(budget)}</div>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
          <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono mb-2">Recent</div>
          <div className="space-y-2">
            {transactions.slice(0, 8).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-sm">
                <div className="truncate pr-2">{tx.description}</div>
                <div className="font-mono text-bf-accent2">-{fmt(tx.amount)}</div>
              </div>
            ))}
            {!transactions.length && <div className="text-sm text-bf-dim">No transactions yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

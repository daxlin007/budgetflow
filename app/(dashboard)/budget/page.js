"use client";

import { useState, useEffect, useRef } from "react";
import { getCategories, getTransactions, insertTransaction } from "../../lib/db";

const fmt = (n) => `$${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nowKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

export default function BudgetPage() {
  const [cats, setCats] = useState([]);
  const [txs, setTxs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const mk = nowKey();

  useEffect(() => {
    Promise.all([getCategories(), getTransactions(mk)])
      .then(([c, t]) => { setCats(c || []); setTxs(t || []); setLoading(false); })
      .catch((e) => { console.error(e); setLoading(false); });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const getCatSpend = (txList) => {
    const spend = {};
    txList.forEach((t) => {
      spend[t.category_id] = (spend[t.category_id] || 0) + parseFloat(t.amount);
    });
    return spend;
  };

  const buildBudgetContext = (txList) => {
    const spend = getCatSpend(txList);
    return cats.map((c) => {
      const spent = spend[c.id] || 0;
      const rem = parseFloat(c.budget) - spent;
      return `${c.name}: ${fmt(spent)} of ${fmt(parseFloat(c.budget))} (${rem >= 0 ? `${fmt(rem)} left` : `${fmt(Math.abs(rem))} over budget`})`;
    }).join("\n");
  };

  const handleSend = async (msgOverride) => {
    const msg = (msgOverride || input).trim();
    if (!msg || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", text: msg }]);

    try {
      const res = await fetch("/api/parse-spending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          categories: cats,
          budgetContext: buildBudgetContext(txs),
        }),
      });

      const data = await res.json();

      if (data.type === "transaction") {
        const saved = [];
        for (const item of data.items) {
          const cat = cats.find((c) => c.slug === item.category_slug);
          if (!cat) continue;
          const tx = await insertTransaction({
            category_id: cat.id,
            amount: item.amount,
            description: item.description,
            date: new Date().toISOString().slice(0, 10),
            is_recurring: false,
            original_message: msg,
          });
          saved.push({ ...tx, catName: cat.name, catEmoji: cat.emoji, catColor: cat.color });
          setTxs((prev) => [tx, ...prev]);
        }
        setMessages((prev) => [...prev, { role: "assistant", type: "transaction", items: saved }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", type: "chat", text: data.message }]);
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", type: "error", text: "Something went wrong. Please try again." }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-bf-dim text-sm font-mono">Loading budget...</div>
      </div>
    );
  }

  const catSpend = getCatSpend(txs);
  const catsWithRemaining = cats.map((c) => ({
    ...c,
    spent: catSpend[c.id] || 0,
    remaining: parseFloat(c.budget) - (catSpend[c.id] || 0),
  }));

  const EXAMPLES = [
    "Spent $45 on groceries",
    "$60 gas and $12 coffee",
    "How's my budget looking?",
  ];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 52px)" }}>
      {/* Category Strip */}
      <div className="flex gap-2 px-4 py-3 border-b border-white/[0.07] overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: "none" }}>
        {catsWithRemaining.length === 0 ? (
          <span className="text-xs text-bf-dim">No categories yet — set them up in Settings.</span>
        ) : catsWithRemaining.map((cat) => {
          const pct = parseFloat(cat.budget) > 0 ? Math.min((cat.spent / parseFloat(cat.budget)) * 100, 100) : 0;
          const over = cat.remaining < 0;
          return (
            <div key={cat.id} className="flex-shrink-0 bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 min-w-[110px]">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{cat.emoji}</span>
                <span className="text-[10px] text-bf-dim truncate max-w-[70px]">{cat.name}</span>
              </div>
              <div className="font-mono">
                <span className={`text-[13px] font-bold ${over ? "text-bf-accent2" : "text-bf-accent"}`}>
                  {over ? `-${fmt(Math.abs(cat.remaining))}` : fmt(cat.remaining)}
                </span>
                <span className={`text-[10px] ml-1 ${over ? "text-bf-accent2" : "text-bf-dim"}`}>
                  {over ? "over" : "left"}
                </span>
              </div>
              <div className="h-0.5 rounded-full mt-1.5 bg-white/[0.05] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? "#E8927C" : cat.color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
            <div className="text-5xl mb-4">💬</div>
            <h2 className="text-lg font-semibold mb-1">Chat your spending</h2>
            <p className="text-bf-dim text-sm mb-6 max-w-[280px]">
              Just describe what you spent — AI categorizes it automatically.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[320px]">
              {EXAMPLES.map((eg) => (
                <button
                  key={eg}
                  onClick={() => handleSend(eg)}
                  className="text-sm text-bf-dim bg-white/[0.03] border border-white/[0.07] rounded-xl py-2.5 px-4 cursor-pointer hover:bg-white/[0.06] hover:text-bf-text transition text-left"
                >
                  {eg}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.type === "transaction" ? (
              <div className="bg-bf-accent/[0.06] border border-bf-accent/[0.2] rounded-2xl px-4 py-3 max-w-[80%]">
                <div className="text-[10px] text-bf-accent font-mono tracking-widest mb-2">✓ LOGGED</div>
                {msg.items.map((item, j) => (
                  <div key={j} className="flex items-center justify-between gap-6">
                    <span className="text-[13px]">{item.catEmoji} {item.description}</span>
                    <span className="text-[13px] font-mono font-semibold text-bf-accent2 flex-shrink-0">-{fmt(parseFloat(item.amount))}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-bf-accent/10 border border-bf-accent/20 text-bf-text"
                  : msg.type === "error"
                  ? "bg-bf-accent2/[0.08] border border-bf-accent2/[0.15] text-bf-accent2"
                  : "bg-white/[0.04] border border-white/[0.07] text-bf-text"
              }`}>
                {msg.text}
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl px-4 py-3 text-sm text-bf-dim font-mono">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="px-4 pb-4 pt-2 border-t border-white/[0.07] flex-shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Try "Spent $45 groceries" or "How am I doing?"'
            disabled={sending}
            className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-bf-text text-sm outline-none focus:border-bf-accent/30 transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="px-5 py-3 rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-sm font-bold cursor-pointer disabled:opacity-30 transition hover:opacity-90 flex-shrink-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

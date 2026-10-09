"use client";

import { useState, useEffect, useRef } from "react";
import { getCategories, getTransactions, insertTransaction } from "../../lib/db";

const nowKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmt = (n) =>
  `$${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const inputCls =
  "bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-bf-text placeholder:text-bf-dim focus:outline-none focus:border-bf-accent/50 w-full";
const btnPrimary =
  "bg-bf-accent text-bf-bg text-sm font-semibold rounded-lg px-4 py-2 hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed";
const btnGhost =
  "bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-bf-dim hover:text-bf-text hover:bg-white/[0.08] transition";

function buildBudgetContext(cats, txs) {
  const spend = {};
  txs.forEach((t) => {
    spend[t.category_id] = (spend[t.category_id] || 0) + parseFloat(t.amount);
  });
  return cats
    .map((c) => {
      const s = spend[c.id] || 0;
      return `${c.name}: spent ${fmt(s)} of ${fmt(parseFloat(c.budget || 0))} budget`;
    })
    .join("\n");
}

export default function BudgetPage() {
  const [cats, setCats] = useState([]);
  const [budgetContext, setBudgetContext] = useState("");
  const [monthSpent, setMonthSpent] = useState(0);
  const [monthBudget, setMonthBudget] = useState(0);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Tell me what you spent — e.g. “$45 groceries” or “$60 gas and $12 coffee”.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [savingIdx, setSavingIdx] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    Promise.all([getCategories(), getTransactions(nowKey())])
      .then(([c, t]) => {
        setCats(c || []);
        setBudgetContext(buildBudgetContext(c || [], t || []));
        setMonthSpent((t || []).reduce((s, x) => s + parseFloat(x.amount), 0));
        setMonthBudget((c || []).reduce((s, x) => s + parseFloat(x.budget || 0), 0));
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const catBySlug = (slug) => cats.find((c) => c.slug === slug);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setSending(true);

    try {
      const res = await fetch("/api/parse-spending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          categories: cats.map((c) => ({ slug: c.slug, name: c.name })),
          budgetContext,
        }),
      });
      const data = await res.json();

      if (data.type === "transaction" && Array.isArray(data.items) && data.items.length) {
        const items = data.items.map((it) => {
          const match = catBySlug(it.category_slug);
          return {
            amount: Number(it.amount) || 0,
            category_id: match ? match.id : "",
            description: it.description || "",
          };
        });
        setMessages((m) => [...m, { role: "assistant", pending: items, sourceText: text }]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: data.message || "Got it." },
        ]);
      }
    } catch (e) {
      console.error(e);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Something went wrong reaching the parser. Try again." },
      ]);
    } finally {
      setSending(false);
    }
  }

  function updatePending(msgIdx, itemIdx, patch) {
    setMessages((m) =>
      m.map((msg, i) =>
        i === msgIdx
          ? { ...msg, pending: msg.pending.map((it, j) => (j === itemIdx ? { ...it, ...patch } : it)) }
          : msg
      )
    );
  }

  function removePendingItem(msgIdx, itemIdx) {
    setMessages((m) =>
      m.map((msg, i) =>
        i === msgIdx ? { ...msg, pending: msg.pending.filter((_, j) => j !== itemIdx) } : msg
      )
    );
  }

  async function confirmPending(msgIdx) {
    const msg = messages[msgIdx];
    const items = (msg.pending || []).filter((it) => it.amount > 0 && it.category_id);
    if (!items.length) return;
    setSavingIdx(msgIdx);
    try {
      for (const it of items) {
        await insertTransaction({
          category_id: it.category_id,
          amount: it.amount,
          description: it.description || "Expense",
          date: todayStr(),
          original_message: msg.sourceText || null,
        });
      }
      const total = items.reduce((s, it) => s + parseFloat(it.amount), 0);
      setMessages((m) =>
        m.map((x, i) => (i === msgIdx ? { role: "assistant", text: `Saved ${fmt(total)} across ${items.length} item${items.length > 1 ? "s" : ""}.` } : x))
      );
      // Refresh month totals
      getTransactions(nowKey()).then((t) =>
        setMonthSpent((t || []).reduce((s, x) => s + parseFloat(x.amount), 0))
      );
    } catch (e) {
      console.error(e);
      setMessages((m) => [...m, { role: "assistant", text: "Couldn't save — try again." }]);
    } finally {
      setSavingIdx(null);
    }
  }

  const pct = monthBudget > 0 ? Math.min((monthSpent / monthBudget) * 100, 100) : 0;

  return (
    <div className="max-w-[780px] mx-auto px-5 py-6 flex flex-col h-[calc(100vh-52px)]">
      {/* Month summary strip */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl px-5 py-3.5 mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[11px] text-bf-dim tracking-widest uppercase font-mono">This month</span>
          <span className="text-sm font-mono">
            <span className="font-bold">{fmt(monthSpent)}</span>
            <span className="text-bf-dim"> / {fmt(monthBudget)}</span>
          </span>
        </div>
        <div className="h-1.5 rounded-sm bg-white/[0.05] overflow-hidden">
          <div
            className="h-full rounded-sm transition-all duration-500"
            style={{ width: `${pct}%`, background: pct >= 100 ? "#E8927C" : "#7CC5A8" }}
          />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4">
        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="self-end max-w-[85%] bg-bf-accent/15 border border-bf-accent/25 rounded-2xl rounded-br-md px-4 py-2.5 text-sm">
              {msg.text}
            </div>
          ) : msg.pending ? (
            <div key={i} className="self-start w-full max-w-[95%] bg-white/[0.03] border border-white/[0.07] rounded-2xl rounded-bl-md p-4 animate-fade-up">
              <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono mb-3">
                Confirm {msg.pending.length} item{msg.pending.length > 1 ? "s" : ""}
              </div>
              <div className="flex flex-col gap-2.5 mb-3">
                {msg.pending.map((it, j) => (
                  <div key={j} className="flex gap-2 items-center">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.amount}
                      onChange={(e) => updatePending(i, j, { amount: parseFloat(e.target.value) || 0 })}
                      className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm font-mono w-[90px] focus:outline-none focus:border-bf-accent/50"
                    />
                    <select
                      value={it.category_id}
                      onChange={(e) => updatePending(i, j, { category_id: e.target.value })}
                      className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm flex-1 focus:outline-none focus:border-bf-accent/50"
                    >
                      <option value="">Pick category…</option>
                      {cats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.emoji} {c.name}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => removePendingItem(i, j)} className="text-bf-dim hover:text-bf-accent2 text-lg px-1" title="Remove">
                      ×
                    </button>
                  </div>
                ))}
                {msg.pending.map((it, j) => (
                  <input
                    key={`d${j}`}
                    value={it.description}
                    onChange={(e) => updatePending(i, j, { description: e.target.value })}
                    placeholder="Description"
                    className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-bf-dim focus:outline-none focus:border-bf-accent/50"
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => confirmPending(i)} disabled={savingIdx === i} className={btnPrimary}>
                  {savingIdx === i ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setMessages((m) => m.filter((_, x) => x !== i))}
                  className={btnGhost}
                >
                  Discard
                </button>
              </div>
            </div>
          ) : (
            <div key={i} className="self-start max-w-[85%] bg-white/[0.04] border border-white/[0.07] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm whitespace-pre-wrap">
              {msg.text}
            </div>
          )
        )}
        {sending && (
          <div className="self-start flex items-center gap-2 text-bf-dim text-sm px-1">
            <span className="w-2 h-2 rounded-full bg-bf-accent animate-pulse-dot" />
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder='Try "$45 groceries" or "how am I doing on dining?"'
          className={inputCls}
          disabled={sending}
        />
        <button onClick={send} disabled={sending || !input.trim()} className={btnPrimary}>
          Send
        </button>
      </div>
    </div>
  );
}

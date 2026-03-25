"use client";

import { useState, useEffect, useRef } from "react";
import {
  getCategories,
  getProfile,
  getTransactions,
  insertTransaction,
  populateRecurringForMonth,
} from "../../lib/db";

const nowKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const fmt = (n) =>
  `$${Math.abs(n).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function BudgetPage() {
  const [cats, setCats] = useState([]);
  const [profile, setProfile] = useState(null);
  const [monthTxs, setMonthTxs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const mk = nowKey();
    Promise.all([getCategories(), getProfile(), getTransactions(mk)])
      .then(([c, p, t]) => {
        setCats(c || []);
        setProfile(p);
        setMonthTxs(t || []);
        setReady(true);

        // Personalized welcome message
        const firstName = (p?.name || "there").split(" ")[0];
        const totalSpent = (t || []).reduce(
          (s, tx) => s + parseFloat(tx.amount),
          0
        );
        const income = parseFloat(p?.monthly_income) || 0;
        const totalBudget = (c || []).reduce(
          (s, cat) => s + parseFloat(cat.budget || 0),
          0
        );
        const remaining = totalBudget - totalSpent;

        let contextHint = "";
        if (totalSpent > 0 && totalBudget > 0) {
          contextHint = `\n\nThis month you've spent **${fmt(totalSpent)}** of your **${fmt(totalBudget)}** budget — **${fmt(remaining)}** remaining.`;
        }

        setMessages([
          {
            role: "assistant",
            content: `Hey ${firstName}! 👋 I'm your budget assistant. Tell me what you've spent and I'll log it instantly.${contextHint}\n\nTry: *"$45 groceries and $15 coffee"*`,
            id: "welcome",
          },
        ]);

        // Populate recurring expenses for this month (idempotent — won't duplicate)
        populateRecurringForMonth(mk)
          .then((added) => {
            if (added > 0) {
              setMonthTxs((prev) => [...prev]); // trigger re-render hint
            }
          })
          .catch(console.error);
      })
      .catch(console.error);
  }, []);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildBudgetContext = (currentTxs) => {
    if (!profile || !cats.length) return "No budget data yet.";
    const income = parseFloat(profile.monthly_income) || 0;
    const totalBudget = cats.reduce(
      (s, c) => s + parseFloat(c.budget || 0),
      0
    );
    const totalSpent = currentTxs.reduce(
      (s, t) => s + parseFloat(t.amount),
      0
    );
    const catSpend = {};
    currentTxs.forEach((t) => {
      catSpend[t.category_id] = (catSpend[t.category_id] || 0) + parseFloat(t.amount);
    });

    const catLines = cats
      .map((c) => {
        const spent = catSpend[c.id] || 0;
        const budget = parseFloat(c.budget || 0);
        return `  ${c.name}: spent ${fmt(spent)} of ${fmt(budget)} budget`;
      })
      .join("\n");

    return [
      `Monthly income: ${fmt(income)}`,
      `Total budget: ${fmt(totalBudget)}`,
      `Total spent this month: ${fmt(totalSpent)}`,
      `Remaining: ${fmt(totalBudget - totalSpent)}`,
      `Savings so far: ${income > 0 ? ((income - totalSpent) / income * 100).toFixed(0) : 0}% of income`,
      ``,
      `Category breakdown:`,
      catLines,
    ].join("\n");
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMsg = input.trim();
    setInput("");
    const userMsgId = Date.now();
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMsg, id: userMsgId },
    ]);
    setSending(true);

    try {
      const res = await fetch("/api/parse-spending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          categories: cats,
          budgetContext: buildBudgetContext(monthTxs),
        }),
      });

      const data = await res.json();

      if (data.type === "transaction" && Array.isArray(data.items) && data.items.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const inserted = [];

        for (const item of data.items) {
          const cat = cats.find((c) => c.slug === item.category_slug);
          const tx = await insertTransaction({
            category_id: cat?.id || null,
            amount: item.amount,
            description: item.description,
            date: today,
            original_message: userMsg,
          });
          inserted.push({ ...tx, catEmoji: cat?.emoji || "📦" });
        }

        // Update local month totals so context stays fresh
        setMonthTxs((prev) => [...prev, ...inserted]);

        const lines =
          inserted.length === 1
            ? `Logged ✓  ${inserted[0].catEmoji} **${inserted[0].description}** — ${fmt(inserted[0].amount)}`
            : `Logged ${inserted.length} transactions ✓\n${inserted
                .map((tx) => `• ${tx.catEmoji} ${tx.description} — ${fmt(tx.amount)}`)
                .join("\n")}`;

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: lines, id: Date.now() },
        ]);
      } else if (data.type === "chat") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message, id: Date.now() },
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Oops! Something went wrong. Please try again.",
          id: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="max-w-[680px] mx-auto px-5 flex flex-col"
      style={{ height: "calc(100vh - 52px)" }}
    >
      {/* Chat history */}
      <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === "user"
                  ? "bg-bf-accent/[0.12] border border-bf-accent/[0.2] text-bf-text"
                  : "bg-white/[0.04] border border-white/[0.07] text-bf-text"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-white/[0.04] border border-white/[0.07] px-4 py-3 rounded-2xl">
              <div className="flex gap-1 items-center">
                <div
                  className="w-1.5 h-1.5 rounded-full bg-bf-dim animate-pulse-dot"
                />
                <div
                  className="w-1.5 h-1.5 rounded-full bg-bf-dim animate-pulse-dot"
                  style={{ animationDelay: "0.2s" }}
                />
                <div
                  className="w-1.5 h-1.5 rounded-full bg-bf-dim animate-pulse-dot"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex gap-2 py-4 border-t border-white/[0.07]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder='e.g. "$45 groceries and $15 coffee"'
          disabled={sending || !ready}
          className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-bf-text outline-none focus:border-bf-accent/30 transition placeholder:text-bf-dim/50"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim() || !ready}
          className="px-5 py-3 rounded-xl bg-bf-accent/[0.15] border border-bf-accent/[0.25] text-bf-accent text-sm font-semibold disabled:opacity-40 hover:bg-bf-accent/[0.22] transition cursor-pointer"
        >
          Send
        </button>
      </div>
    </div>
  );
}

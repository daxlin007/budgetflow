"use client";

import { useState, useEffect, useRef } from "react";
import { getCategories, getTransactions, getAllTransactions, insertTransaction } from "../../lib/db";

const GUIDE_TIPS = [
  { label: "Log a single expense", examples: ["Spent $45 on groceries", "Grabbed lunch for $18", "Filled up the tank — $60"] },
  { label: "Log multiple at once", examples: ["$60 gas and $12 coffee", "$200 Costco run and $9.99 Netflix"] },
  { label: "Ask about your budget", examples: ["How's my grocery budget?", "Am I on track this month?", "Where am I overspending?"] },
  { label: "Natural language works", examples: ["Weekly shop came to $95", "Car service today, set me back $180", "Date night — $75 dinner and $30 drinks"] },
];

const fmt = (n) => `$${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nowKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

export default function BudgetPage() {
  const [cats, setCats] = useState([]);
  const [txs, setTxs] = useState([]);
  const [allTxs, setAllTxs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const mk = nowKey();

  // Load categories, transactions, and chat sessions on mount
  useEffect(() => {
    Promise.all([getCategories(), getTransactions(mk), getAllTransactions()])
      .then(([c, t, allT]) => { setCats(c || []); setTxs(t || []); setAllTxs(allT || []); setLoading(false); })
      .catch((e) => { console.error(e); setLoading(false); });

    // Load chat sessions
    loadChatSessions();
  }, []);

  // Load chat history when active chat changes
  useEffect(() => {
    if (activeChatId) {
      loadChatHistory(activeChatId);
    }
  }, [activeChatId]);

  const loadChatSessions = async () => {
    setLoadingChats(true);
    try {
      const res = await fetch("/api/chat/sessions");
      if (!res.ok) throw new Error("Failed to load sessions");
      const sessions = await res.json();

      if (sessions.length === 0) {
        // Create initial chat session
        const newRes = await fetch("/api/chat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Chat" })
        });
        if (!newRes.ok) throw new Error("Failed to create session");
        const newSession = await newRes.json();
        setChatSessions([newSession]);
        setActiveChatId(newSession.id);
      } else {
        setChatSessions(sessions);
        setActiveChatId(sessions[0].id);
      }
    } catch (e) {
      console.error("Error loading chat sessions:", e);
    } finally {
      setLoadingChats(false);
    }
  };

  const loadChatHistory = async (sessionId) => {
    try {
      const res = await fetch(`/api/chat/messages?sessionId=${sessionId}`);
      if (!res.ok) throw new Error("Failed to load messages");
      const msgs = await res.json();
      setMessages(msgs.map(m => ({ role: m.role, type: m.type, text: m.text, items: m.items })));
    } catch (e) {
      console.error("Error loading chat history:", e);
    }
  };

  const handleCreateNewChat = async () => {
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Chat" })
      });
      if (!res.ok) throw new Error("Failed to create session");
      const newSession = await res.json();
      setChatSessions(prev => [newSession, ...prev]);
      setActiveChatId(newSession.id);
    } catch (e) {
      console.error("Error creating new chat:", e);
    }
  };

  const handleDeleteChat = async (sessionId, e) => {
    e.stopPropagation();
    if (chatSessions.length === 1) {
      alert("Cannot delete the last chat session");
      return;
    }
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete session");
      setChatSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeChatId === sessionId) {
        const nextSession = chatSessions.find(s => s.id !== sessionId);
        if (nextSession) {
          setActiveChatId(nextSession.id);
        }
      }
    } catch (e) {
      console.error("Error deleting chat:", e);
    }
  };

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

  const getYTDCatSpend = (txList) => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const spend = {};
    txList.forEach((t) => {
      const txDate = new Date(t.date);
      if (txDate >= yearStart) {
        spend[t.category_id] = (spend[t.category_id] || 0) + parseFloat(t.amount);
      }
    });
    return spend;
  };

  const buildBudgetContext = (txList, allTxList) => {
    const spend = getCatSpend(txList);
    const ytdSpend = getYTDCatSpend(allTxList);
    return cats.map((c) => {
      const spent = spend[c.id] || 0;
      const ytd = ytdSpend[c.id] || 0;
      const rem = parseFloat(c.budget) - spent;
      return `${c.name}: ${fmt(spent)} of ${fmt(parseFloat(c.budget))} this month (${rem >= 0 ? `${fmt(rem)} left` : `${fmt(Math.abs(rem))} over budget`}). Year-to-date: ${fmt(ytd)}`;
    }).join("\n");
  };

  const saveChatMessage = async (sessionId, role, type, text, items) => {
    try {
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, role, type, text, items })
      });
    } catch (e) {
      console.error("Error saving message:", e);
    }
  };

  const handleSend = async (msgOverride) => {
    const msg = (msgOverride || input).trim();
    if (!msg || sending || !activeChatId) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", text: msg }]);

    // Save user message to database
    await saveChatMessage(activeChatId, "user", "chat", msg, null);

    try {
      const res = await fetch("/api/parse-spending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          categories: cats,
          budgetContext: buildBudgetContext(txs, allTxs),
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
        // Save transaction message to database
        await saveChatMessage(activeChatId, "assistant", "transaction", null, saved.map(s => ({ amount: s.amount, category_slug: cats.find(c => c.id === s.category_id)?.slug, description: s.description })));
      } else {
        setMessages((prev) => [...prev, { role: "assistant", type: "chat", text: data.message }]);
        // Save assistant message to database
        await saveChatMessage(activeChatId, "assistant", "chat", data.message, null);
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", type: "error", text: "Something went wrong. Please try again." }]);
      await saveChatMessage(activeChatId, "assistant", "error", "Something went wrong. Please try again.", null);
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


  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 52px)" }}>
      {/* Chat Tabs */}
      <div className="flex gap-1 px-3 sm:px-4 py-2 sm:py-3 border-b border-white/[0.07] overflow-x-auto flex-shrink-0 items-center" style={{ scrollbarWidth: "none" }}>
        {chatSessions.map((session) => (
          <button
            key={session.id}
            onClick={() => setActiveChatId(session.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg sm:rounded-xl flex-shrink-0 transition text-sm ${
              activeChatId === session.id
                ? "bg-bf-accent/10 border border-bf-accent/30 text-bf-text"
                : "bg-white/[0.03] border border-white/[0.07] text-bf-dim hover:text-bf-text hover:bg-white/[0.06]"
            }`}
          >
            <span className="truncate max-w-[80px]">{session.title}</span>
            <button
              onClick={(e) => handleDeleteChat(session.id, e)}
              className="text-xs ml-1 p-0 opacity-60 hover:opacity-100 transition"
            >
              ✕
            </button>
          </button>
        ))}
        <button
          onClick={handleCreateNewChat}
          className="ml-1 px-2.5 py-2 rounded-lg sm:rounded-xl bg-white/[0.03] border border-white/[0.07] text-bf-dim hover:text-bf-text hover:bg-white/[0.06] transition flex-shrink-0 text-sm"
          title="New chat"
        >
          +
        </button>
      </div>

      {/* Category Strip */}
      <div className="flex gap-2 px-3 sm:px-4 py-2 sm:py-3 border-b border-white/[0.07] overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: "none" }}>
        {catsWithRemaining.length === 0 ? (
          <span className="text-[11px] sm:text-xs text-bf-dim">No categories yet — set them up in Settings.</span>
        ) : catsWithRemaining.map((cat) => {
          const pct = parseFloat(cat.budget) > 0 ? Math.min((cat.spent / parseFloat(cat.budget)) * 100, 100) : 0;
          const over = cat.remaining < 0;
          return (
            <div key={cat.id} className="flex-shrink-0 bg-white/[0.03] border border-white/[0.07] rounded-lg sm:rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 min-w-[100px] sm:min-w-[110px]">
              <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
                <span className="text-xs sm:text-sm flex-shrink-0">{cat.emoji}</span>
                <span className="text-[9px] sm:text-[10px] text-bf-dim truncate max-w-[60px] sm:max-w-[70px]">{cat.name}</span>
              </div>
              <div className="font-mono">
                <span className={`text-[11px] sm:text-[13px] font-bold ${over ? "text-bf-accent2" : "text-bf-accent"}`}>
                  {over ? `-${fmt(Math.abs(cat.remaining))}` : fmt(cat.remaining)}
                </span>
                <span className={`text-[8px] sm:text-[10px] ml-0.5 sm:ml-1 ${over ? "text-bf-accent2" : "text-bf-dim"}`}>
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
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col gap-2 sm:gap-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
            <div className="text-5xl mb-4">💬</div>
            <h2 className="text-lg font-semibold mb-1">Chat your spending</h2>
            <p className="text-bf-dim text-sm mb-5 max-w-[280px]">
              Just describe what you spent in plain English — AI figures out the category and amount.
            </p>
            {/* Quick-start examples */}
            <div className="flex flex-col gap-2 w-full max-w-[320px] mb-6">
              {["Spent $45 on groceries", "$60 gas and $12 coffee", "How's my budget looking?"].map((eg) => (
                <button
                  key={eg}
                  onClick={() => handleSend(eg)}
                  className="text-sm text-bf-dim bg-white/[0.03] border border-white/[0.07] rounded-xl py-2.5 px-4 cursor-pointer hover:bg-white/[0.06] hover:text-bf-text transition text-left"
                >
                  {eg}
                </button>
              ))}
            </div>
            {/* Inline guide */}
            <button
              onClick={() => setShowGuide((v) => !v)}
              className="text-xs text-bf-accent bg-bf-accent/[0.08] border border-bf-accent/[0.2] rounded-lg px-3 py-1.5 cursor-pointer hover:bg-bf-accent/[0.14] transition"
            >
              {showGuide ? "Hide tips ↑" : "What else can I say? ↓"}
            </button>
            {showGuide && (
              <div className="mt-4 w-full max-w-[420px] bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 text-left">
                <div className="text-[10px] text-bf-dim font-mono tracking-widest uppercase mb-3">What you can say</div>
                <div className="flex flex-col gap-4">
                  {GUIDE_TIPS.map((tip) => (
                    <div key={tip.label}>
                      <div className="text-[11px] font-semibold text-bf-text mb-1.5">{tip.label}</div>
                      {tip.examples.map((ex) => (
                        <button
                          key={ex}
                          onClick={() => { setShowGuide(false); handleSend(ex); }}
                          className="block w-full text-left text-[12px] text-bf-dim bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2 mb-1 cursor-pointer hover:bg-white/[0.06] hover:text-bf-text transition font-mono"
                        >
                          "{ex}"
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
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

      {/* Guide panel — shown above input when toggled from ? button */}
      {showGuide && messages.length > 0 && (
        <div className="mx-4 mb-2 bg-bf-bg border border-white/[0.1] rounded-2xl p-4 shadow-xl max-h-[50vh] overflow-y-auto flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] text-bf-dim font-mono tracking-widest uppercase">What you can say</div>
            <button onClick={() => setShowGuide(false)} className="text-bf-dim hover:text-bf-text bg-transparent border-none cursor-pointer text-sm">✕</button>
          </div>
          <div className="flex flex-col gap-3">
            {GUIDE_TIPS.map((tip) => (
              <div key={tip.label}>
                <div className="text-[11px] font-semibold text-bf-text mb-1.5">{tip.label}</div>
                {tip.examples.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => { setShowGuide(false); setInput(ex); inputRef.current?.focus(); }}
                    className="block w-full text-left text-[12px] text-bf-dim bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 mb-1 cursor-pointer hover:bg-white/[0.07] hover:text-bf-text transition font-mono"
                  >
                    "{ex}"
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 border-t border-white/[0.07] flex-shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            title="Tips & examples"
            className={`px-2 sm:px-3 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border text-sm cursor-pointer transition flex-shrink-0 ${showGuide ? "bg-bf-accent/10 border-bf-accent/30 text-bf-accent" : "bg-white/[0.04] border-white/[0.07] text-bf-dim hover:text-bf-text hover:bg-white/[0.07]"}`}
          >
            ?
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Try "Spent $45 groceries" or "How am I doing?"'
            disabled={sending}
            className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-bf-text text-sm outline-none focus:border-bf-accent/30 transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="px-3 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-bf-accent to-emerald-600 text-bf-bg text-xs sm:text-sm font-bold cursor-pointer disabled:opacity-30 transition hover:opacity-90 flex-shrink-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

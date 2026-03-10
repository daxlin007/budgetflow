"use client";

import { useState, useEffect } from "react";
import { getCategories, getAllTransactions, getProfile } from "../../lib/db";

const fmt = (n) => `$${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`);
const nowKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const mkLabel = (k) => { const [y, m] = k.split("-"); return new Date(+y, +m - 1).toLocaleDateString("en-CA", { month: "long", year: "numeric" }); };
const mkShort = (k) => { const [y, m] = k.split("-"); return new Date(+y, +m - 1).toLocaleDateString("en-CA", { month: "short" }); };
const shiftMk = (k, d) => { const [y, m] = k.split("-").map(Number); const dt = new Date(y, m - 1 + d, 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; };
const last6 = (k) => { const a = []; for (let i = 5; i >= 0; i--) a.push(shiftMk(k, -i)); return a; };

export default function DashboardPage() {
  const [cats, setCats] = useState([]);
  const [txs, setTxs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [selMonth, setSelMonth] = useState(nowKey());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCategories(), getAllTransactions(), getProfile()])
      .then(([c, t, p]) => { setCats(c || []); setTxs(t || []); setProfile(p); setLoading(false); })
      .catch((e) => { console.error(e); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-bf-dim text-sm font-mono">Loading dashboard...</div>
      </div>
    );
  }

  const mk = nowKey();
  const isCur = selMonth === mk;
  const income = parseFloat(profile?.monthly_income) || 0;
  const totalBudget = cats.reduce((s, c) => s + parseFloat(c.budget || 0), 0);

  // Filter transactions for selected month
  const sTxs = txs.filter((t) => t.date.startsWith(selMonth));
  const sTotalSpent = sTxs.reduce((s, t) => s + parseFloat(t.amount), 0);
  const sCatSpend = {};
  sTxs.forEach((t) => {
    const cid = t.category_id;
    sCatSpend[cid] = (sCatSpend[cid] || 0) + parseFloat(t.amount);
  });

  const pctBudget = totalBudget > 0 ? (sTotalSpent / totalBudget) * 100 : 0;
  const remaining = totalBudget - sTotalSpent;
  const pctIncome = income > 0 ? (sTotalSpent / income) * 100 : 0;
  const savingsRate = income > 0 ? ((income - sTotalSpent) / income) * 100 : 0;

  const sorted = cats.map((c) => ({ ...c, spent: sCatSpend[c.id] || 0 })).sort((a, b) => b.spent - a.spent);
  const active = sorted.filter((c) => c.spent > 0);

  // Daily spending
  const [sY, sM] = selMonth.split("-").map(Number);
  const daysIn = new Date(sY, sM, 0).getDate();
  const today = new Date();
  const dayN = isCur ? today.getDate() : daysIn;

  const daily = [];
  for (let d = 1; d <= daysIn; d++) {
    const k = `${selMonth}-${String(d).padStart(2, "0")}`;
    daily.push({ d, amt: sTxs.filter((t) => t.date === k).reduce((s, t) => s + parseFloat(t.amount), 0) });
  }
  const maxD = Math.max(...daily.map((x) => x.amt), 1);

  // 6-month trend
  const getTotal = (m) => txs.filter((t) => t.date.startsWith(m)).reduce((s, t) => s + parseFloat(t.amount), 0);
  const m6 = last6(selMonth).map((m) => ({ key: m, label: mkShort(m), total: getTotal(m), cur: m === selMonth }));
  const max6 = Math.max(...m6.map((x) => x.total), totalBudget, 1);

  // Donut
  const donutSz = 170, donutSt = 20, donutR = (donutSz - donutSt) / 2, donutC = 2 * Math.PI * donutR;
  let dOff = 0;

  const mProg = (dayN / daysIn) * 100;
  const pace = pctBudget <= mProg ? "under" : "over";

  const arrowCls = "bg-white/[0.05] border border-white/[0.07] rounded-lg px-3 py-1.5 cursor-pointer text-bf-dim text-sm hover:bg-white/[0.08] transition";

  return (
    <div className="max-w-[780px] mx-auto px-5 py-6">
      {/* Month Navigator */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setSelMonth(shiftMk(selMonth, -1))} className={arrowCls}>◂</button>
        <div className="flex-1 text-center">
          <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono">{isCur ? "Current Month" : "Viewing"}</div>
          <h1 className="text-2xl font-bold mt-0.5">{mkLabel(selMonth)}</h1>
          {!isCur && <button onClick={() => setSelMonth(mk)} className="text-xs text-bf-accent bg-transparent border-none cursor-pointer mt-0.5">Jump to current →</button>}
        </div>
        <button onClick={() => { if (selMonth < mk) setSelMonth(shiftMk(selMonth, 1)); }} className={arrowCls} style={{ opacity: selMonth >= mk ? 0.25 : 1 }}>▸</button>
      </div>

      {/* Top Row: Donut + Stats */}
      <div className="flex gap-4 mb-5 flex-wrap">
        {/* Donut */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 flex flex-col items-center min-w-[210px]">
          <div className="relative" style={{ width: donutSz, height: donutSz }}>
            <svg width={donutSz} height={donutSz} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={donutSz / 2} cy={donutSz / 2} r={donutR} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={donutSt} />
              {active.map((cat) => {
                const catPct = sTotalSpent > 0 ? cat.spent / sTotalSpent : 0;
                const segLen = catPct * donutC * Math.min(pctBudget / 100, 1);
                const gap = active.length > 1 ? 3 : 0;
                const el = <circle key={cat.id} cx={donutSz / 2} cy={donutSz / 2} r={donutR} fill="none" stroke={cat.color} strokeWidth={donutSt} strokeDasharray={`${Math.max(segLen - gap, 0)} ${donutC}`} strokeDashoffset={-dOff} className="transition-all duration-700" />;
                dOff += segLen;
                return el;
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[26px] font-bold leading-none">{Math.round(pctBudget)}%</div>
              <div className="text-[10px] text-bf-dim mt-0.5">of budget</div>
            </div>
          </div>
          <div className="mt-3 text-center">
            <div className="text-xl font-bold font-mono">{fmt(sTotalSpent)}</div>
            <div className="text-[11px] text-bf-dim mt-0.5">of {fmt(totalBudget)} budget</div>
          </div>
        </div>

        {/* Stats Column */}
        <div className="flex-1 flex flex-col gap-2 min-w-[200px]">
          <div className={`rounded-xl p-4 ${remaining >= 0 ? "bg-bf-accent/[0.06] border border-bf-accent/[0.15]" : "bg-bf-accent2/[0.08] border border-bf-accent2/[0.2]"}`}>
            <div className="text-[10px] text-bf-dim tracking-widest uppercase font-mono">{isCur ? "Remaining" : remaining >= 0 ? "Under Budget" : "Over Budget"}</div>
            <div className={`text-2xl font-bold font-mono mt-1 ${remaining >= 0 ? "text-bf-accent" : "text-bf-accent2"}`}>{remaining >= 0 ? fmt(remaining) : `-${fmt(Math.abs(remaining))}`}</div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-3.5">
              <div className="text-[10px] text-bf-dim tracking-widest uppercase font-mono">Of Income</div>
              <div className={`text-xl font-bold font-mono mt-1 ${pctIncome > 90 ? "text-bf-accent2" : ""}`}>{Math.round(pctIncome)}%</div>
            </div>
            <div className="flex-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-3.5">
              <div className="text-[10px] text-bf-dim tracking-widest uppercase font-mono">Savings</div>
              <div className={`text-xl font-bold font-mono mt-1 ${savingsRate >= 20 ? "text-bf-accent" : savingsRate >= 0 ? "text-bf-warn" : "text-bf-accent2"}`}>{savingsRate.toFixed(0)}%</div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-3.5">
              <div className="text-[10px] text-bf-dim tracking-widest uppercase font-mono">{isCur ? "Pace" : "Txns"}</div>
              {isCur ? (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className={`w-2 h-2 rounded-full ${pace === "under" ? "bg-bf-accent shadow-[0_0_6px_rgba(124,197,168,0.4)]" : "bg-bf-accent2 shadow-[0_0_6px_rgba(232,146,124,0.4)]"}`} />
                  <span className={`text-sm font-semibold ${pace === "under" ? "text-bf-accent" : "text-bf-accent2"}`}>{pace === "under" ? "On Track" : "Over Pace"}</span>
                </div>
              ) : (
                <div className="text-xl font-bold font-mono mt-1">{sTxs.length}</div>
              )}
            </div>
            <div className="flex-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-3.5">
              <div className="text-[10px] text-bf-dim tracking-widest uppercase font-mono">Daily Avg</div>
              <div className="text-xl font-bold font-mono mt-1">{dayN > 0 ? fmt(sTotalSpent / dayN) : "$0"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 6-Month Trend */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 mb-4">
        <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono mb-4">6-Month Trend</div>
        <div className="flex items-end gap-2 h-[110px]">
          {m6.map((m) => {
            const h = max6 > 0 ? Math.max((m.total / max6) * 90, m.total > 0 ? 4 : 0) : 0;
            const budH = max6 > 0 ? (totalBudget / max6) * 90 : 0;
            const over = m.total > totalBudget;
            return (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer" style={{ opacity: m.cur ? 1 : 0.65 }} onClick={() => setSelMonth(m.key)}>
                {m.total > 0 && <span className="text-[9px] font-mono" style={{ color: m.cur ? "#E8E6E1" : "rgba(255,255,255,0.38)" }}>{fmtShort(m.total)}</span>}
                <div className="w-full relative h-[90px] flex items-end">
                  <div className="absolute left-0 right-0" style={{ bottom: budH, borderTop: "1px dashed rgba(124,197,168,0.2)" }} />
                  <div className="w-full rounded-[5px] transition-all duration-500" style={{
                    height: h,
                    background: m.cur ? (over ? "linear-gradient(180deg,#E8927C,rgba(232,146,124,0.4))" : "linear-gradient(180deg,#7CC5A8,rgba(124,197,168,0.4))") : (over ? "rgba(232,146,124,0.2)" : "rgba(124,197,168,0.12)"),
                  }} />
                </div>
                <span className="text-[10px] font-mono" style={{ fontWeight: m.cur ? 700 : 400, color: m.cur ? "#7CC5A8" : "rgba(255,255,255,0.38)" }}>{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 mb-4">
        <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono mb-3">By Category</div>
        <div className="flex flex-col gap-2.5">
          {sorted.map((cat) => {
            const budget = parseFloat(cat.budget) || 0;
            const pct = budget > 0 ? (cat.spent / budget) * 100 : 0;
            const over = cat.spent > budget;
            const remaining = budget - cat.spent;
            return (
              <div key={cat.id}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px]">{cat.emoji}</span>
                    <span className="text-[13px] font-medium">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Remaining / over — the at-a-glance number */}
                    {budget > 0 && (
                      <span className={`text-[12px] font-semibold font-mono ${over ? "text-bf-accent2" : cat.spent > 0 ? "text-bf-accent" : "text-bf-dim"}`}>
                        {over ? `-${fmt(Math.abs(remaining))} over` : `${fmt(remaining)} left`}
                      </span>
                    )}
                    {/* Spent / budget */}
                    <div className="flex items-baseline gap-1 text-right">
                      <span className={`text-[12px] font-mono ${over ? "text-bf-accent2" : cat.spent > 0 ? "text-bf-dim" : "text-bf-dim"}`}>{fmt(cat.spent)}</span>
                      <span className="text-[10px] text-bf-dim font-mono">/ {fmtShort(budget)}</span>
                    </div>
                  </div>
                </div>
                <div className="h-1 rounded-sm bg-white/[0.05] overflow-hidden">
                  <div className="h-full rounded-sm transition-all duration-600" style={{ width: `${Math.min(pct, 100)}%`, background: over ? "#E8927C" : cat.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced Analytics */}
      {sTxs.length > 0 && (() => {
        // Weekday spending
        const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const dayTotals = Array(7).fill(0);
        sTxs.forEach((t) => {
          const dow = new Date(t.date + "T12:00:00").getDay();
          dayTotals[dow] += parseFloat(t.amount);
        });
        const maxDay = Math.max(...dayTotals, 1);
        const topDayIdx = dayTotals.indexOf(Math.max(...dayTotals));

        // Recurring vs one-time
        const recurringTotal = sTxs.filter((t) => t.is_recurring).reduce((s, t) => s + parseFloat(t.amount), 0);
        const oneTimeTotal = sTxs.filter((t) => !t.is_recurring).reduce((s, t) => s + parseFloat(t.amount), 0);
        const recurringPct = sTotalSpent > 0 ? (recurringTotal / sTotalSpent) * 100 : 0;

        // Budget efficiency score: % of categories that are under budget (with spend > 0)
        const activeWithBudget = sorted.filter((c) => c.spent > 0 && parseFloat(c.budget) > 0);
        const underBudget = activeWithBudget.filter((c) => c.spent <= parseFloat(c.budget));
        const effScore = activeWithBudget.length > 0 ? Math.round((underBudget.length / activeWithBudget.length) * 100) : 100;
        const effColor = effScore >= 80 ? "text-bf-accent" : effScore >= 50 ? "text-bf-warn" : "text-bf-accent2";

        return (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 mb-4">
            <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono mb-4">Spending Insights</div>
            <div className="flex gap-4 flex-wrap">

              {/* Weekday Breakdown */}
              <div className="flex-1 min-w-[180px]">
                <div className="text-[10px] text-bf-dim font-mono mb-3">By Day of Week</div>
                <div className="flex items-end gap-1 h-[70px]">
                  {DAYS.map((d, i) => {
                    const h = maxDay > 0 ? Math.max((dayTotals[i] / maxDay) * 60, dayTotals[i] > 0 ? 4 : 0) : 0;
                    const isTop = i === topDayIdx && dayTotals[i] > 0;
                    return (
                      <div key={d} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-[3px] transition-all duration-500" style={{
                          height: h,
                          background: isTop ? "linear-gradient(180deg,#7CC5A8,rgba(124,197,168,0.3))" : "rgba(255,255,255,0.08)"
                        }} />
                        <span className={`text-[9px] font-mono ${isTop ? "text-bf-accent font-bold" : "text-bf-dim"}`}>{d}</span>
                      </div>
                    );
                  })}
                </div>
                {dayTotals[topDayIdx] > 0 && (
                  <p className="text-[10px] text-bf-dim mt-2">
                    Highest spend on <span className="text-bf-text font-medium">{DAYS[topDayIdx]}</span> — {fmt(dayTotals[topDayIdx])}
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="w-px bg-white/[0.07] hidden sm:block" />

              {/* Recurring vs One-Time */}
              <div className="flex-1 min-w-[140px]">
                <div className="text-[10px] text-bf-dim font-mono mb-3">Recurring vs One-Time</div>
                <div className="h-2 rounded-full overflow-hidden bg-white/[0.05] mb-3">
                  <div className="h-full bg-bf-accent/60 transition-all duration-700" style={{ width: `${recurringPct}%` }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-bf-accent/60" />
                      <span className="text-[11px] text-bf-dim">Recurring</span>
                    </div>
                    <span className="text-[11px] font-mono text-bf-text">{fmt(recurringTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-white/[0.2]" />
                      <span className="text-[11px] text-bf-dim">One-Time</span>
                    </div>
                    <span className="text-[11px] font-mono text-bf-text">{fmt(oneTimeTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="w-px bg-white/[0.07] hidden sm:block" />

              {/* Budget Efficiency */}
              <div className="flex-1 min-w-[120px] flex flex-col items-center justify-center">
                <div className="text-[10px] text-bf-dim font-mono mb-2">Budget Efficiency</div>
                <div className={`text-4xl font-bold font-mono ${effColor}`}>{effScore}%</div>
                <div className="text-[10px] text-bf-dim mt-1 text-center">
                  {underBudget.length}/{activeWithBudget.length} categories under budget
                </div>
                <div className={`text-[10px] font-medium mt-2 ${effColor}`}>
                  {effScore >= 80 ? "Excellent control" : effScore >= 50 ? "Room to improve" : "Over budget"}
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Recent Transactions */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
        <div className="text-[11px] text-bf-dim tracking-widest uppercase font-mono mb-3">Transactions — {mkShort(selMonth)}</div>
        {sTxs.length === 0 ? (
          <div className="text-center py-6 text-bf-dim text-sm">{isCur ? "💬 Chat your first expense in the Budget tab!" : "📭 No transactions."}</div>
        ) : (
          sTxs.slice(0, 8).map((tx) => {
            const cat = cats.find((c) => c.id === tx.category_id);
            return (
              <div key={tx.id} className="flex items-center py-2 border-b border-white/[0.04]">
                <span className="text-base mr-2.5">{cat?.emoji || "📦"}</span>
                <div className="flex-1">
                  <div className="text-[13px]">{tx.description}{tx.is_recurring && <span className="text-[9px] text-bf-accent ml-1.5 font-mono">↻</span>}</div>
                  <div className="text-[10px] text-bf-dim">{tx.date}</div>
                </div>
                <span className="text-[13px] font-semibold text-bf-accent2 font-mono">-{fmt(parseFloat(tx.amount))}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

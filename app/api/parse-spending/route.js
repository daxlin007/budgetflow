import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase-server";

// ─── Local spending parser ──────────────────────────────────────────────────
// No AI, no API cost. Extracts dollar amounts and matches categories by keyword
// scoring against the user's own category names/slugs plus common synonyms.

const SYNONYMS = [
  ["grocer", ["grocery", "groceries", "supermarket", "walmart", "costco", "superstore", "safeway", "sobeys", "loblaws", "market", "food"]],
  ["gas", ["fuel", "petrol", "shell", "esso", "petro", "husky", "tank", "fill up", "filled up"]],
  ["dining", ["coffee", "restaurant", "lunch", "dinner", "breakfast", "brunch", "tim hortons", "timmies", "starbucks", "cafe", "pizza", "burger", "sushi", "takeout", "take out", "eat out", "mcdonald"]],
  ["mortgage", ["mortgage", "house payment"]],
  ["rent", ["rent"]],
  ["insurance", ["insurance"]],
  ["car", ["car", "auto", "vehicle", "hyundai", "elantra", "oil change", "mechanic", "repair"]],
  ["utilit", ["electric", "electricity", "power", "water", "internet", "wifi", "phone", "bill", "enmax", "utility", "utilities"]],
  ["subscrip", ["netflix", "spotify", "subscription", "prime", "disney", "apple tv", "youtube"]],
  ["transport", ["bus", "train", "uber", "lyft", "taxi", "transit", "parking", "c-train"]],
  ["daycare", ["daycare", "childcare", "babysit"]],
  ["lesson", ["lesson", "tutor", "tutoring", "class"]],
  ["health", ["pharmacy", "doctor", "dentist", "gym", "prescription", "shoppers"]],
  ["personal", ["clothes", "clothing", "haircut", "barber", "salon", "fun", "movie", "game"]],
  ["travel", ["flight", "hotel", "airbnb", "vacation", "trip"]],
  ["gift", ["gift", "present", "donation"]],
  ["pet", ["vet", "pet", "dog", "cat"]],
];

const STOP_WORDS = new Set(["a", "an", "the", "and", "or", "of", "/", "&", "my", "to"]);

function categoryTerms(cat) {
  const terms = new Set();
  const slug = (cat.slug || "").toLowerCase();
  const name = (cat.name || "").toLowerCase();
  slug.split(/[-_]/).forEach((w) => { if (w && !STOP_WORDS.has(w)) terms.add(w); });
  name.split(/[\s/&,-]+/).forEach((w) => { if (w && !STOP_WORDS.has(w)) terms.add(w); });
  for (const [key, words] of SYNONYMS) {
    if (slug.includes(key) || name.includes(key) || key.includes(slug)) {
      words.forEach((w) => terms.add(w));
    }
  }
  return [...terms];
}

function scoreCategory(text, terms) {
  const t = ` ${text.toLowerCase()} `;
  let score = 0;
  for (const term of terms) {
    if (term.includes(" ")) {
      if (t.includes(` ${term} `) || t.includes(` ${term},`) || t.includes(` ${term}.`)) score += 3;
    } else if (t.includes(` ${term} `) || t.includes(` ${term},`) || t.includes(` ${term}.`) || t.endsWith(` ${term}`)) {
      score += term.length > 4 ? 2 : 1;
    }
  }
  return score;
}

function bestCategory(text, cats, catTerms) {
  let best = null;
  let bestScore = 0;
  for (let i = 0; i < cats.length; i++) {
    const s = scoreCategory(text, catTerms[i]);
    if (s > bestScore) {
      bestScore = s;
      best = cats[i];
    }
  }
  return best;
}

function extractAmounts(text) {
  const out = [];
  const re = /\$?\s*(\d+(?:\.\d{1,2})?)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1];
    const val = parseFloat(raw);
    if (!isFinite(val) || val <= 0) continue;
    // Skip years and month-adjacent numbers (dates, not spending)
    if (/^\d{4}$/.test(raw) && val >= 1900 && val <= 2100) continue;
    if (/^\d{1,2}$/.test(raw)) {
      const ctx = text.slice(Math.max(0, m.index - 14), m.index + raw.length + 14).toLowerCase();
      if (/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/.test(ctx)) continue;
    }
    out.push({ value: Math.round(val * 100) / 100, index: m.index, raw: m[0].trim() });
  }
  return out;
}

function cleanDescription(segment, rawAmount) {
  let s = segment.replace(rawAmount, " ");
  s = s.replace(/^\s*(spent|paid|bought|purchased|got|spend|pay)\b/i, " ");
  s = s.replace(/\b(on|for|at|from|in)\b/gi, " ");
  s = s.replace(/\s+/g, " ").trim().replace(/^[,\-–:;]+|[,\-–:;]+$/g, "").trim();
  if (!s) return "Expense";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const fmt = (n) =>
  `$${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Question answering (template-based, from live data) ─────────────────────
function answerQuestion(text, cats, txs, catTerms) {
  const t = text.toLowerCase();
  const spend = {};
  let total = 0;
  txs.forEach((tx) => {
    const a = parseFloat(tx.amount);
    total += a;
    spend[tx.category_id] = (spend[tx.category_id] || 0) + a;
  });
  const budget = cats.reduce((s, c) => s + parseFloat(c.budget || 0), 0);

  if (/(how am i doing|summary|status|overview|report|breakdown)/.test(t)) {
    const ranked = cats
      .map((c) => ({ c, s: spend[c.id] || 0 }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3);
    const lines = ranked.map((x) => `• ${x.c.emoji} ${x.c.name}: ${fmt(x.s)} of ${fmt(parseFloat(x.c.budget || 0))}`);
    return `This month you've spent ${fmt(total)} of your ${fmt(budget)} budget.\n\n${lines.join("\n") || "Nothing logged yet."}`;
  }

  if (/(remaining|left|budget)/.test(t)) {
    const over = cats
      .map((c) => ({ c, s: spend[c.id] || 0, b: parseFloat(c.budget || 0) }))
      .filter((x) => x.b > 0 && x.s >= x.b);
    const left = budget - total;
    const overLine = over.length
      ? `\n\nOver budget: ${over.map((x) => `${x.c.emoji} ${x.c.name}`).join(", ")}`
      : "";
    return `${fmt(left)} left of your ${fmt(budget)} monthly budget.${overLine}`;
  }

  // "how much did I spend on X" / "spent on X"
  const catMatch = bestCategory(t, cats, catTerms);
  if (catMatch && /(how much|spent|spend)/.test(t)) {
    const s = spend[catMatch.id] || 0;
    const b = parseFloat(catMatch.budget || 0);
    return `${catMatch.emoji} ${catMatch.name}: ${fmt(s)} spent${b > 0 ? ` of ${fmt(b)} budgeted` : " this month"}.`;
  }

  return null;
}

export async function POST(request) {
  // Verify user is authenticated
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message } = await request.json();

  if (!message || !message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const text = message.trim();

  // Load the user's categories + this month's transactions (server-side)
  const now = new Date();
  const mk = monthKey(now);
  const startDate = `${mk}-01`;
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [{ data: cats }, { data: txs }] = await Promise.all([
    supabase.from("categories").select("id, slug, name, emoji, budget").eq("user_id", user.id).order("sort_order"),
    supabase.from("transactions").select("amount, category_id").eq("user_id", user.id).gte("date", startDate).lte("date", endDate),
  ]);

  const categories = cats || [];
  const transactions = txs || [];
  const catTerms = categories.map(categoryTerms);

  // ── 1. Try to extract spending ──
  const amounts = extractAmounts(text);
  if (amounts.length > 0 && categories.length > 0) {
    const segments = text.split(/\s+and\s+|[,;]/i).map((s) => s.trim()).filter(Boolean);
    const items = [];

    for (const a of amounts) {
      const seg = segments.find((s) => {
        const i = text.indexOf(s);
        return i >= 0 && a.index >= i && a.index < i + s.length;
      }) || text;
      const cat = bestCategory(seg, categories, catTerms) || bestCategory(text, categories, catTerms);
      items.push({
        amount: a.value,
        category_slug: cat ? cat.slug : "",
        description: cleanDescription(seg, a.raw),
      });
    }

    if (items.length > 0) {
      return NextResponse.json({ type: "transaction", items });
    }
  }

  // ── 2. Try to answer as a question ──
  const answer = answerQuestion(text, categories, transactions, catTerms);
  if (answer) {
    return NextResponse.json({ type: "chat", message: answer });
  }

  // ── 3. Fallbacks ──
  if (/\?/.test(text) || /^(how|what|show|tell)/i.test(text.trim())) {
    return NextResponse.json({
      type: "chat",
      message: 'I can log spending and give quick summaries. Try "$45 groceries" or "how am I doing?"',
    });
  }

  return NextResponse.json({
    type: "chat",
    message: `I didn't catch an amount there. Try something like "$45 groceries" or "$60 gas and $12 coffee".`,
  });
}

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "../../lib/supabase-server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function normalizeSlug(s = "") {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fallbackParse(message, categories) {
  const msg = String(message || "").trim();
  const lowered = msg.toLowerCase();
  const amountMatches = [...lowered.matchAll(/\$?\s*(\d+(?:\.\d{1,2})?)/g)];

  if (!amountMatches.length) {
    return {
      type: "chat",
      message: "I couldn't find an amount. Try: \"Spent $45 on groceries\".",
    };
  }

  const normalizedCats = (categories || []).map((c) => ({
    ...c,
    nSlug: normalizeSlug(c.slug),
    nName: normalizeSlug(c.name),
  }));

  const pickCategory = (context) => {
    const ctx = normalizeSlug(context);
    return (
      normalizedCats.find((c) => ctx.includes(c.nSlug) || ctx.includes(c.nName)) ||
      normalizedCats[0] ||
      null
    );
  };

  const items = amountMatches.map((m) => {
    const amount = Number(m[1]);
    const slice = lowered.slice(Math.max(0, m.index - 18), Math.min(lowered.length, m.index + 32));
    const cat = pickCategory(slice);
    return {
      amount,
      category_slug: cat?.slug || normalizedCats[0]?.slug || "other",
      description: cat?.name || "Expense",
    };
  });

  return { type: "transaction", items };
}

function parseJsonFromModelText(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last !== -1 && first < last) {
      return JSON.parse(cleaned.slice(first, last + 1));
    }
    throw new Error("Model response was not valid JSON");
  }
}

export async function POST(request) {
  // Verify user is authenticated
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, categories, budgetContext } = await request.json();

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const catList = categories
    .map((c) => `"${c.slug}" (${c.name})`)
    .join(", ");

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(fallbackParse(message, categories));
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are a budget assistant. Extract spending from natural language.

Budget categories: ${catList}

CURRENT BUDGET STATUS:
${budgetContext || "No budget data yet."}

RESPOND WITH ONLY JSON (no markdown, no backticks):

For ONE spending item:
{"type":"transaction","items":[{"amount":<number>,"category_slug":"<slug>","description":"<short desc>"}]}

For MULTIPLE items in one message (e.g. "$40 groceries and $15 coffee"):
{"type":"transaction","items":[{"amount":40,"category_slug":"groceries","description":"Groceries"},{"amount":15,"category_slug":"dining","description":"Coffee"}]}

For questions/chat/non-spending:
{"type":"chat","message":"<response>"}

When responding to chat, you know the user's budget status above. Give specific, helpful advice referencing their actual numbers.

Rules:
- Match BEST category by slug. "fuel my Hyundai" → gas. "coffee" → dining. "Netflix" → subscriptions.
- If no amount given, ask with type "chat"
- Parse multiple items separated by "and", commas, or listed
- Be smart: "filled up the tank" = gas, "weekly shop" = groceries, "grabbed lunch" = dining`,
      messages: [{ role: "user", content: message }],
    });

    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    const parsed = parseJsonFromModelText(text);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Claude API error:", error);
    return NextResponse.json(fallbackParse(message, categories), { status: 200 });
  }
}

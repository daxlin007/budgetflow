import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "../../lib/supabase-server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are a budget assistant. Extract spending from natural language.

Budget categories: ${catList}

CURRENT BUDGET STATUS (This Month + Year-to-Date):
${budgetContext || "No budget data yet."}

RESPOND WITH ONLY JSON (no markdown, no backticks):

For ONE spending item:
{"type":"transaction","items":[{"amount":<number>,"category_slug":"<slug>","description":"<short desc>"}]}

For MULTIPLE items in one message (e.g. "$40 groceries and $15 coffee"):
{"type":"transaction","items":[{"amount":40,"category_slug":"groceries","description":"Groceries"},{"amount":15,"category_slug":"dining","description":"Coffee"}]}

For questions/chat/non-spending:
{"type":"chat","message":"<response>"}

When responding to chat, you know the user's budget status above including year-to-date totals. Give specific, helpful advice referencing their actual numbers. Answer questions about total spending this year, monthly trends, and budget performance.

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

    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Claude API error:", error);
    return NextResponse.json(
      {
        type: "chat",
        message:
          "Sorry, I had trouble understanding that. Try: \"Spent $45 on groceries\" or \"$60 gas and $30 coffee\"",
      },
      { status: 200 } // Return 200 so client handles gracefully
    );
  }
}

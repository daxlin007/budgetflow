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

  // Build a rich category list: "groceries" (Groceries) — for slug matching
  const catList = categories
    .map((c) => `"${c.slug}" (${c.name})`)
    .join(", ");

  // Merchant→category hint map sent to the model so it handles real store names
  const merchantGuide = `
MERCHANT → CATEGORY RECOGNITION (use these when you recognise a store/brand name):

Groceries / Supermarkets:
  Walmart, Walmart Supercenter, Walmart Neighbourhood Market,
  Costco, Costco Wholesale,
  No Frills, Loblaws, Real Canadian Superstore, Zehrs, Valu-Mart,
  Metro, Food Basics, FreshCo, Sobeys, IGA,
  Save-On-Foods, Safeway, Thrifty Foods,
  T&T Supermarket, H-Mart, Farm Boy,
  Whole Foods, Trader Joe's, Aldi, Lidl,
  Bulk Barn (food runs), Dollarama (grocery items)
  → use the closest slug to "groceries"

Dining / Restaurants / Coffee / Fast Food:
  Tim Hortons, Tims,
  Starbucks, Second Cup, Country Style,
  McDonald's, Harvey's, Wendy's, Burger King, A&W,
  KFC, Popeyes, Chick-fil-A, Five Guys,
  Subway, Quiznos, Mr. Sub,
  Pizza Hut, Domino's, Boston Pizza, Pizza Pizza,
  Swiss Chalet, Montana's, East Side Mario's, The Keg,
  Chipotle, Panera, Noodles & Company,
  DoorDash, Skip The Dishes, Uber Eats, Instacart (restaurant orders),
  any sit-down restaurant, any food truck, any café
  → use the closest slug to "dining"

Gas / Fuel:
  Petro-Canada, Esso, Shell, Ultramar, Pioneer, Husky, Mobil,
  Canadian Tire Gas Bar, Costco Gas, Circle K (fuel),
  "filled up", "gas station", "fuel"
  → use the closest slug to "gas"

Subscriptions / Streaming / Software:
  Netflix, Crave, Amazon Prime, Disney+, Apple TV+, Paramount+,
  Spotify, Apple Music, YouTube Premium, Tidal,
  Xbox Game Pass, PlayStation Plus, Nintendo Switch Online,
  Adobe, Microsoft 365, iCloud, Google One, Dropbox,
  any monthly/annual digital service
  → use the closest slug to "subscriptions"

Utilities / Phone / Internet:
  Rogers, Bell, Telus, Fido, Virgin Plus, Freedom Mobile, Public Mobile,
  Hydro One, BC Hydro, Enbridge Gas, Union Gas, Toronto Hydro,
  Shaw, Videotron, Cogeco,
  "hydro bill", "internet bill", "phone bill", "electricity"
  → use the closest slug to "utilities"

Transport / Transit:
  TTC, Presto, OC Transpo, STM, Translink, GO Transit, Via Rail,
  Uber (non-food rides), Lyft, Taxi,
  "parking", "transit pass", "monthly pass"
  → use the closest slug to "transport"

Personal Care / Health:
  Shoppers Drug Mart, Rexall, London Drugs, Jean Coutu,
  Pharmaprix, SDM, "pharmacy", "prescription"
  → map to the closest available category

Shopping / Clothing / Personal:
  Amazon, eBay, Etsy,
  Zara, H&M, Old Navy, Gap, Banana Republic, UNIQLO, Aritzia,
  Nike, Adidas, Foot Locker, Sport Chek,
  Sephora, Ulta, MAC, Bath & Body Works,
  LCBO, Beer Store, SAQ, BC Liquor
  → use the closest slug to "fun" or "personal"

IMPORTANT: If the user's category list does NOT contain the ideal category,
fall back to the CLOSEST available slug. Never invent a slug that isn't in the list.
`.trim();

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are a smart budget assistant. Extract spending from natural language and assign the best matching category.

USER'S CATEGORIES (slug → name) — category_slug MUST be one of these exact slugs:
${catList}

${merchantGuide}

CURRENT BUDGET STATUS:
${budgetContext || "No budget data yet."}

RESPOND WITH ONLY JSON (no markdown, no backticks, no extra text):

For spending (one or multiple items):
{"type":"transaction","items":[{"amount":<number>,"category_slug":"<slug>","description":"<merchant name or short label>"}]}

Example — "$40 Walmart and $15 Tim Hortons":
{"type":"transaction","items":[{"amount":40,"category_slug":"groceries","description":"Walmart"},{"amount":15,"category_slug":"dining","description":"Tim Hortons"}]}

For questions / chat / advice:
{"type":"chat","message":"<response>"}

Rules:
1. description = use the MERCHANT NAME when one is mentioned (e.g. "Walmart", "Tim Hortons"), otherwise a short label
2. category_slug must EXACTLY match a slug from the user's list above
3. If no dollar amount is given, respond with type "chat" asking for the amount
4. Parse multiple items separated by "and", commas, semicolons, or new lines
5. For chat responses, reference the user's actual budget numbers above`,
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

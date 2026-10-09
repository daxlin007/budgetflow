import { createClient } from "./supabase-browser";

const supabase = createClient();

// ─── PROFILE ────────────────────────────────────────────────────────────────
export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(updates) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── CATEGORIES ─────────────────────────────────────────────────────────────
export async function getCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function upsertCategory(category) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("categories")
    .upsert({ ...category, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function insertCategories(categories) {
  const { data: { user } } = await supabase.auth.getUser();
  const rows = categories.map((c, i) => ({
    user_id: user.id,
    slug: c.slug || c.id,
    name: c.name,
    emoji: c.emoji,
    budget: c.budget,
    color: c.color,
    sort_order: i,
  }));

  const { data, error } = await supabase
    .from("categories")
    .insert(rows)
    .select();

  if (error) throw error;
  return data;
}

export async function deleteCategory(id) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

// ─── TRANSACTIONS ───────────────────────────────────────────────────────────
export async function getTransactions(monthKey) {
  let query = supabase
    .from("transactions")
    .select("*, categories(name, emoji, color)")
    .order("date", { ascending: false });

  if (monthKey) {
    const [y, m] = monthKey.split("-").map(Number);
    const startDate = `${monthKey}-01`;
    const endDate = new Date(y, m, 0).toISOString().slice(0, 10);
    query = query.gte("date", startDate).lte("date", endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getAllTransactions() {
  const { data, error } = await supabase
    .from("transactions")
    .select("*, categories(name, emoji, color)")
    .order("date", { ascending: false });

  if (error) throw error;
  return data;
}

export async function insertTransaction(tx) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("transactions")
    .insert({ ...tx, user_id: user.id })
    .select("*, categories(name, emoji, color)")
    .single();

  if (error) throw error;
  return data;
}

export async function updateTransaction(id, updates) {
  const { data, error } = await supabase
    .from("transactions")
    .update(updates)
    .eq("id", id)
    .select("*, categories(name, emoji, color)")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

// ─── RECURRING EXPENSES ─────────────────────────────────────────────────────
export async function getRecurring() {
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select("*, categories(name, emoji, color)")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function insertRecurring(rec) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("recurring_expenses")
    .insert({ ...rec, user_id: user.id })
    .select("*, categories(name, emoji, color)")
    .single();

  if (error) throw error;
  return data;
}

export async function insertRecurringBatch(recs) {
  const { data: { user } } = await supabase.auth.getUser();
  const rows = recs.map(r => ({ ...r, user_id: user.id }));

  const { data, error } = await supabase
    .from("recurring_expenses")
    .insert(rows)
    .select("*, categories(name, emoji, color)");

  if (error) throw error;
  return data;
}

export async function deleteRecurring(id) {
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  if (error) throw error;
}

// ─── POPULATE RECURRING FOR MONTH ───────────────────────────────────────────
export async function populateRecurringForMonth(monthKey) {
  const { data: { user } } = await supabase.auth.getUser();

  // Get recurring expenses
  const { data: recurring } = await supabase
    .from("recurring_expenses")
    .select("*")
    .eq("user_id", user.id);

  if (!recurring?.length) return 0;

  // Check which are already populated this month
  const startDate = `${monthKey}-01`;
  const [y, m] = monthKey.split("-").map(Number);
  const endDate = new Date(y, m, 0).toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("transactions")
    .select("recurring_id, category_id, amount")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate);

  const existingIds = new Set((existing || []).map(t => t.recurring_id));

  // A bill counts as paid if a previous populate inserted it (recurring_id
  // match) OR if it was logged manually this month for the same category
  // and amount (e.g. marked "fully spent" by hand before tapping the button).
  const paidKeys = new Set(
    (existing || []).map(t => `${t.category_id}|${parseFloat(t.amount).toFixed(2)}`)
  );
  const billKey = (r) => `${r.category_id}|${parseFloat(r.amount).toFixed(2)}`;

  // Insert missing ones
  const toInsert = recurring
    .filter(r => !existingIds.has(r.id) && !paidKeys.has(billKey(r)))
    .map(r => ({
      user_id: user.id,
      category_id: r.category_id,
      amount: r.amount,
      description: r.description,
      date: startDate,
      is_recurring: true,
      recurring_id: r.id,
    }));

  if (toInsert.length === 0) return 0;

  const { error } = await supabase.from("transactions").insert(toInsert);
  if (error) throw error;
  return toInsert.length;
}

// ─── MONTHLY SUMMARY (for dashboard trend chart) ────────────────────────────
export async function getMonthlySummaries(months) {
  const { data: { user } } = await supabase.auth.getUser();
  const summaries = {};

  for (const mk of months) {
    const [y, m] = mk.split("-").map(Number);
    const startDate = `${mk}-01`;
    const endDate = new Date(y, m, 0).toISOString().slice(0, 10);

    const { data } = await supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate);

    summaries[mk] = (data || []).reduce((s, t) => s + parseFloat(t.amount), 0);
  }

  return summaries;
}

// ─── EXPORT ─────────────────────────────────────────────────────────────────
export { supabase };

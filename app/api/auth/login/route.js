import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase-server";

export async function POST(request) {
  const supabase = createClient();
  const { email, password } = await request.json();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ user: data.user });
}

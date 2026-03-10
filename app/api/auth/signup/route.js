import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase-server";

export async function POST(request) {
  const supabase = createClient();
  const { email, password, name } = await request.json();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ user: data.user });
}

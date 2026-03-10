import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase-server";

export async function PATCH(request, { params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title } = await request.json();

  try {
    const { data, error } = await supabase
      .from("chat_sessions")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating chat session:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Delete messages in session (cascade handled by DB, explicit for safety)
    await supabase
      .from("chat_messages")
      .delete()
      .eq("session_id", params.id)
      .eq("user_id", user.id);

    // Delete session
    const { error } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chat session:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

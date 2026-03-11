import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "../../../lib/supabase-admin";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request) {
  // Verify this request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get all users
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error("Failed to fetch users:", usersError);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const results = { sent: 0, failed: 0 };

  for (const user of users) {
    if (!user.email) continue;

    // Get transactions logged today for this user
    const { data: todayTxs } = await supabase
      .from("transactions")
      .select("amount, description, categories(name, emoji)")
      .eq("user_id", user.id)
      .eq("date", today);

    const name = user.user_metadata?.name || user.email.split("@")[0];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://beldav.com";

    const txRows = (todayTxs || [])
      .map(
        (t) =>
          `<tr>
            <td style="padding:6px 12px;">${t.categories?.emoji || ""} ${t.categories?.name || ""}</td>
            <td style="padding:6px 12px;">${t.description}</td>
            <td style="padding:6px 12px; font-weight:600;">$${parseFloat(t.amount).toFixed(2)}</td>
          </tr>`
      )
      .join("");

    const loggedSection =
      todayTxs?.length > 0
        ? `<p style="color:#555;">Here's what you logged today:</p>
           <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:16px;">
             <thead>
               <tr style="background:#f3f4f6; text-align:left;">
                 <th style="padding:6px 12px;">Category</th>
                 <th style="padding:6px 12px;">Description</th>
                 <th style="padding:6px 12px;">Amount</th>
               </tr>
             </thead>
             <tbody>${txRows}</tbody>
           </table>
           <p style="color:#555;">Anything else to add?</p>`
        : `<p style="color:#555;">You haven't logged any expenses yet today. Did you buy something? Take 30 seconds to keep your budget on track!</p>`;

    const { error: emailError } = await resend.emails.send({
      from: `BudgetFlow <reminders@${new URL(appUrl).hostname}>`,
      to: user.email,
      subject: "Did you buy something today? 💸",
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: sans-serif; background:#f9fafb; margin:0; padding:0;">
            <div style="max-width:520px; margin:40px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.07);">
              <div style="background:#16a34a; padding:28px 32px;">
                <h1 style="margin:0; color:#fff; font-size:22px;">💰 BudgetFlow</h1>
              </div>
              <div style="padding:28px 32px;">
                <h2 style="margin-top:0; color:#111; font-size:18px;">Hey ${name}, quick check-in!</h2>
                ${loggedSection}
                <a href="${appUrl}/dashboard"
                   style="display:inline-block; margin-top:12px; padding:12px 24px; background:#16a34a; color:#fff; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px;">
                  Log Expenses →
                </a>
              </div>
              <div style="padding:16px 32px; border-top:1px solid #f0f0f0; font-size:12px; color:#999;">
                You're receiving this because you have a BudgetFlow account.
                <a href="${appUrl}/dashboard/settings" style="color:#16a34a;">Manage preferences</a>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (emailError) {
      console.error(`Failed to send to ${user.email}:`, emailError);
      results.failed++;
    } else {
      results.sent++;
    }
  }

  return NextResponse.json({ ok: true, ...results });
}

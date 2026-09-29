import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getTrustedAppOrigin } from "@/lib/security.mjs";

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const sender = process.env.RESEND_FROM_EMAIL;
  const appOrigin = getTrustedAppOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (!cronSecret || !serviceKey || !resendKey || !sender) return NextResponse.json({ error: "Follow-up service is not configured." }, { status: 503 });
  if (!appOrigin) return NextResponse.json({ error: "Set NEXT_PUBLIC_APP_URL to the production app URL." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });
  const { data: due, error } = await admin.from("estimates").select("id, user_id, client_name, client_email").eq("status", "pending").not("followup_at", "is", null).lte("followup_at", new Date().toISOString()).is("followup_sent_at", null).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const estimate of due ?? []) {
    const link = `${appOrigin}/estimate/${encodeURIComponent(estimate.id)}`;
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: sender,
        to: [estimate.client_email],
        subject: "Following up on your estimate",
        text: `Hi ${estimate.client_name || "there"}, just checking whether you have any questions about your estimate. Review it here: ${link}`,
        html: `<p>Hi ${String(estimate.client_name || "there").replace(/[&<>]/g, "")},</p><p>Just checking whether you have any questions about your estimate.</p><p><a href="${link}">Review your estimate</a></p>`,
      }),
    });
    const responseData = await result.json();
    if (!result.ok) continue;
    await admin.from("estimates").update({ followup_sent_at: new Date().toISOString() }).eq("id", estimate.id);
    await admin.from("estimate_email_events").insert({ user_id: estimate.user_id, estimate_id: estimate.id, recipient: estimate.client_email, provider_email_id: responseData.id, event: "follow_up_sent" });
    sent++;
  }
  return NextResponse.json({ sent, checked: due?.length ?? 0 });
}

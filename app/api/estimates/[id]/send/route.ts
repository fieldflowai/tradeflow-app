import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (char) => entities[char]);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => cookieStore.getAll() } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to send estimates." }, { status: 401 });
  const { data: subscription } = await supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle();
  if (!subscription || !["active", "trialing"].includes(subscription.status)) return NextResponse.json({ error: "Branded estimate email is a Pro feature." }, { status: 403 });

  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !sender) return NextResponse.json({ error: "Email sending is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL." }, { status: 503 });

  const { data: estimate, error: estimateError } = await supabase.from("estimates").select("id, user_id, client_name, client_email, job_address").eq("id", id).eq("user_id", user.id).single();
  if (estimateError || !estimate) return NextResponse.json({ error: "Estimate not found in your account." }, { status: 404 });
  const { data: items, error: itemsError } = await supabase.from("line_items").select("description, quantity, unit_price").eq("estimate_id", id);
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  const origin = new URL(request.url).origin;
  const link = `${origin}/estimate/${encodeURIComponent(id)}`;
  const rows = (items ?? []).map((item) => {
    const amount = Number(item.quantity || 0) * Number(item.unit_price || 0);
    return `<tr><td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(item.description)}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right">$${amount.toFixed(2)}</td></tr>`;
  }).join("");
  const safeName = escapeHtml(estimate.client_name || "there");
  const total = (items ?? []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: sender,
      to: [estimate.client_email],
      subject: `Your TradeFlow estimate from ${user.user_metadata?.business_name || "your contractor"}`,
      text: `Hi ${estimate.client_name}, your estimate is ready. View it here: ${link}`,
      html: `<div style="font-family:Arial,sans-serif;color:#1d2925;max-width:640px;margin:auto"><h1 style="font-size:22px">Your estimate is ready</h1><p>Hi ${safeName},</p><p>Here is the estimate for ${escapeHtml(estimate.job_address || "your project")}.</p><table style="border-collapse:collapse;width:100%">${rows}<tr><td style="padding:12px;font-weight:bold">Estimate total</td><td style="padding:12px;text-align:right;font-weight:bold">$${total.toFixed(2)}</td></tr></table><p style="margin:24px 0"><a href="${link}" style="background:#c85b2d;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Review estimate</a></p><p style="font-size:12px;color:#68736c">Sent with TradeFlow</p></div>`,
    }),
  });
  const responseData = await emailResponse.json();
  if (!emailResponse.ok) return NextResponse.json({ error: responseData.message || "Could not send the estimate email." }, { status: 502 });

  await supabase.from("estimate_email_events").insert({ user_id: user.id, estimate_id: id, recipient: estimate.client_email, provider_email_id: responseData.id, event: "sent" });
  const followupAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("estimates").update({ followup_at: followupAt, followup_sent_at: null }).eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ success: true, emailId: responseData.id });
}

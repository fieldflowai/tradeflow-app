import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Questions are temporarily unavailable." }, { status: 503 });

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    payload = parsed as Record<string, unknown>;
  } catch { return NextResponse.json({ error: "Enter your details and question." }, { status: 400 }); }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (typeof payload.company_website === "string" && payload.company_website.trim()) return NextResponse.json({ success: true });
  if (name.length < 2 || name.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 || message.length < 5 || message.length > 2000) {
    return NextResponse.json({ error: "Enter a valid name, email, and question (up to 2,000 characters)." }, { status: 400 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: estimate } = await admin.from("estimates").select("id, user_id, client_name").eq("id", id).maybeSingle();
  if (!estimate) return NextResponse.json({ error: "This proposal could not be found." }, { status: 404 });

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: proposalCount, error: limitError } = await admin.from("proposal_questions").select("id", { count: "exact", head: true })
    .eq("estimate_id", id).gte("created_at", oneHourAgo);
  if (limitError) return NextResponse.json({ error: "Questions are temporarily unavailable." }, { status: 503 });
  if ((proposalCount ?? 0) >= 10) return NextResponse.json({ error: "This proposal has reached its question limit for now. Please contact the contractor directly." }, { status: 429 });
  const { count, error: customerLimitError } = await admin.from("proposal_questions").select("id", { count: "exact", head: true })
    .eq("estimate_id", id).eq("customer_email", email).gte("created_at", oneHourAgo);
  if (customerLimitError) return NextResponse.json({ error: "Questions are temporarily unavailable." }, { status: 503 });
  if ((count ?? 0) >= 3) return NextResponse.json({ error: "Please wait before sending another question about this proposal." }, { status: 429 });

  const { error } = await admin.from("proposal_questions").insert({
    estimate_id: id, user_id: estimate.user_id, customer_name: name, customer_email: email, message,
  });
  if (error) {
    console.error("Could not store proposal question:", error.message);
    return NextResponse.json({ error: "Your question could not be saved. Please try again." }, { status: 500 });
  }

  const { data: ownerData } = await admin.auth.admin.getUserById(estimate.user_id);
  const businessEmail = ownerData.user?.email;
  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.RESEND_FROM_EMAIL;
  let emailSent = false;
  if (businessEmail && apiKey && sender) {
    try {
      const mail = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: sender, to: [businessEmail], reply_to: email, subject: `Customer question about estimate ${id}`,
          text: `${name} (${email}) asked about ${estimate.client_name}'s proposal:\n\n${message}`,
          html: `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) asked a question about proposal ${escapeHtml(id)}:</p><blockquote>${escapeHtml(message).replace(/\n/g, "<br>")}</blockquote><p>Reply directly to this email to respond.</p>` }),
      });
      emailSent = mail.ok;
      if (!mail.ok) console.error("Proposal question notification email failed:", await mail.text());
    } catch (mailError) { console.error("Proposal question notification failed:", mailError); }
  }
  return NextResponse.json({ success: true, emailSent });
}

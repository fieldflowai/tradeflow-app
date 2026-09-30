import { NextResponse } from "next/server";
import { finishAudit, requireTradeFlowAdmin, sameOrigin, startAudit, validReason } from "@/lib/admin-support";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const access = await requireTradeFlowAdmin();
  if ("response" in access) return access.response;
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!validReason(body.reason)) return NextResponse.json({ error: "Provide a support reason of at least 8 characters." }, { status: 400 });
  const { data: target, error: targetError } = await access.admin.auth.admin.getUserById(id);
  if (targetError || !target.user?.email) return NextResponse.json({ error: "Account with a verified email was not found." }, { status: 404 });

  let auditId: string;
  try {
    auditId = await startAudit(access.admin, access.user.id, id, "password_recovery_sent", body.reason, { delivery: "supabase_auth_email" }, access.user.email);
  } catch {
    return NextResponse.json({ error: "Could not write the required support audit entry." }, { status: 503 });
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const { error } = await access.admin.auth.resetPasswordForEmail(target.user.email, {
    redirectTo: `${appUrl.replace(/\/$/, "")}/auth/confirm?next=%2Freset-password`,
  });
  await finishAudit(access.admin, auditId, error ? "failed" : "succeeded");
  if (error) {
    console.error("Admin password recovery request failed:", error.message);
    return NextResponse.json({ error: "Supabase could not send a recovery email. Check Auth SMTP and rate limits." }, { status: 502 });
  }
  return NextResponse.json({ success: true, message: "A password recovery email was requested through Supabase Auth." });
}

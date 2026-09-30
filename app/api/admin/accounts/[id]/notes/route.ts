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
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const category = typeof body.category === "string" ? body.category : "support";
  if (!["support", "bug_report", "billing", "email_delivery"].includes(category)) return NextResponse.json({ error: "Choose a valid support category." }, { status: 400 });
  if (!note || note.length > 5000) return NextResponse.json({ error: "Note must be between 1 and 5,000 characters." }, { status: 400 });
  if (!validReason(body.reason)) return NextResponse.json({ error: "Provide a support reason of at least 8 characters." }, { status: 400 });
  const { data: target, error: targetError } = await access.admin.auth.admin.getUserById(id);
  if (targetError || !target.user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  let auditId: string;
  try {
    auditId = await startAudit(access.admin, access.user.id, id, "support_note_added", body.reason, { category, note_length: note.length }, access.user.email);
  } catch {
    return NextResponse.json({ error: "Could not write the required support audit entry." }, { status: 503 });
  }
  const { error } = await access.admin.from("tradeflow_support_notes").insert({ target_user_id: id, actor_user_id: access.user.id, actor_email: access.user.email, category, note });
  await finishAudit(access.admin, auditId, error ? "failed" : "succeeded");
  if (error) return NextResponse.json({ error: "Could not save the support note." }, { status: 502 });
  return NextResponse.json({ success: true });
}

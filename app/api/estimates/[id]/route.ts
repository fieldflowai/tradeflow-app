import { NextResponse } from "next/server";
import { createUserSupabaseClient } from "@/app/utils/supabase/server";

type LineItemInput = {
  description: string;
  description_es?: string | null;
  quantity: number;
  unit_price: number;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function validLineItems(value: unknown): value is LineItemInput[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Record<string, unknown>;
    return typeof candidate.description === "string" &&
      candidate.description.trim().length > 0 &&
      candidate.description.length <= 240 &&
      typeof candidate.quantity === "number" &&
      Number.isFinite(candidate.quantity) &&
      candidate.quantity > 0 &&
      candidate.quantity <= 100000 &&
      typeof candidate.unit_price === "number" &&
      Number.isFinite(candidate.unit_price) &&
      candidate.unit_price >= 0 &&
      candidate.unit_price <= 100000000 &&
      (candidate.description_es === undefined || candidate.description_es === null || (typeof candidate.description_es === "string" && candidate.description_es.length <= 240));
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createUserSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Sign in to edit this estimate.", 401);

  const { data: estimate, error } = await supabase
    .from("estimates")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Estimate lookup failed:", error.message);
    return jsonError("Unable to load this estimate.", 500);
  }
  if (!estimate) return jsonError("Estimate not found.", 404);

  const { data: lineItems, error: itemError } = await supabase
    .from("line_items")
    .select("id, description, description_es, quantity, unit_price")
    .eq("estimate_id", id);

  if (itemError) {
    console.error("Estimate line item lookup failed:", itemError.message);
    return jsonError("Unable to load estimate line items.", 500);
  }

  const { data: attachmentRows } = await supabase.from("estimate_attachments")
    .select("id, storage_path, media_type, content_type, created_at").eq("estimate_id", id).eq("user_id", user.id);
  const attachments = await Promise.all((attachmentRows ?? []).map(async (attachment) => {
    const { data } = await supabase.storage.from("estimate-media").createSignedUrl(attachment.storage_path, 60 * 60);
    return data?.signedUrl ? { id: attachment.id, media_type: attachment.media_type, content_type: attachment.content_type, created_at: attachment.created_at, url: data.signedUrl } : null;
  }));

  return NextResponse.json({ estimate, lineItems: lineItems ?? [], attachments: attachments.filter(Boolean) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createUserSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Sign in to edit this estimate.", 401);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonError("Invalid estimate details.", 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const clientName = typeof body.client_name === "string" ? body.client_name.trim() : "";
  const clientEmail = typeof body.client_email === "string" ? body.client_email.trim() : "";
  const clientPhone = typeof body.client_phone === "string" ? body.client_phone.trim() : "";
  const jobAddress = typeof body.job_address === "string" ? body.job_address.trim() : "";
  const proposalLanguage = body.proposal_language === "es" ? "es" : "en";
  const depositPercentage = Number(body.deposit_percentage);
  const taxRate = Number(body.tax_rate);
  const markupPercentage = Number(body.markup_percentage);
  if (!clientName || clientName.length > 200 || !clientEmail || clientEmail.length > 320 ||
      clientPhone.length > 80 || jobAddress.length > 500 || !validLineItems(body.lineItems) ||
      !Number.isFinite(depositPercentage) || depositPercentage < 0 || depositPercentage > 100) {
    return jsonError("Check the customer details, deposit percentage, and line items.", 400);
  }
  if ((body.tax_rate !== undefined && (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)) ||
      (body.markup_percentage !== undefined && (!Number.isFinite(markupPercentage) || markupPercentage < 0 || markupPercentage > 500))) {
    return jsonError("Tax must be between 0 and 100%, and markup between 0 and 500%.", 400);
  }

  const { data: existing, error: lookupError } = await supabase
    .from("estimates")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError) {
    console.error("Estimate ownership check failed:", lookupError.message);
    return jsonError("Unable to update this estimate.", 500);
  }
  if (!existing) return jsonError("Estimate not found.", 404);
  if (existing.status === "paid") return jsonError("Paid estimates cannot be edited.", 409);

  const estimateUpdate: Record<string, unknown> = {
    client_name: clientName,
    client_email: clientEmail,
    client_phone: clientPhone,
    job_address: jobAddress,
    require_deposit: body.require_deposit === true,
    deposit_percentage: depositPercentage,
    package_options: Array.isArray(body.package_options) ? body.package_options : [],
    proposal_language: proposalLanguage,
    status: "pending",
    updated_at: new Date().toISOString(),
  };
  if (body.tax_rate !== undefined) estimateUpdate.tax_rate = taxRate;
  if (body.markup_percentage !== undefined) estimateUpdate.markup_percentage = markupPercentage;
  if (typeof body.trade === "string") estimateUpdate.trade = body.trade.slice(0, 80);

  const { error: updateError } = await supabase
    .from("estimates")
    .update(estimateUpdate)
    .eq("id", id)
    .eq("user_id", user.id);
  if (updateError) {
    console.error("Estimate update failed:", updateError.message);
    return jsonError("Unable to update this estimate.", 500);
  }

  const { error: deleteError } = await supabase
    .from("line_items")
    .delete()
    .eq("estimate_id", id);
  if (deleteError) {
    console.error("Estimate line item replacement failed:", deleteError.message);
    return jsonError("Estimate details were saved, but its line items could not be updated.", 500);
  }

  const { error: insertError } = await supabase.from("line_items").insert(
    body.lineItems.map((item) => ({
      estimate_id: id,
      description: item.description.trim(),
      description_es: item.description_es?.trim() || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }))
  );
  if (insertError) {
    console.error("Estimate line item insert failed:", insertError.message);
    return jsonError("Estimate details were saved, but its line items could not be updated.", 500);
  }

  return NextResponse.json({ success: true }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

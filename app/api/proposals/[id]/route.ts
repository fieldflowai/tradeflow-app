import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Proposal viewing is temporarily unavailable." }, { status: 503 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: estimate, error } = await admin
    .from("estimates")
    .select("id, user_id, client_name, client_email, client_phone, job_address, status, require_deposit, deposit_percentage, tax_rate, markup_percentage, proposal_language, converted_job_id, created_at, package_options, signature_name, selected_package, accepted_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Proposal lookup failed:", error.message);
    return NextResponse.json({ error: "Unable to load this proposal." }, { status: 500 });
  }
  if (!estimate) return NextResponse.json({ error: "Proposal not found or link expired." }, { status: 404 });

  const { data: ownerData } = estimate.user_id
    ? await admin.auth.admin.getUserById(estimate.user_id)
    : { data: { user: null } };
  const metadata = ownerData.user?.user_metadata ?? {};
  const contractor = {
    businessName: typeof metadata.business_name === "string" && metadata.business_name.trim() ? metadata.business_name.trim() : "Your Contractor",
    phone: typeof metadata.phone === "string" ? metadata.phone : "",
    address: typeof metadata.business_address === "string" ? metadata.business_address : "",
    logoUrl: typeof metadata.logo_url === "string" && metadata.logo_url.startsWith("https://") ? metadata.logo_url : "",
    brandColor: typeof metadata.brand_color === "string" && /^#[0-9a-f]{6}$/i.test(metadata.brand_color) ? metadata.brand_color : "#c85b2d",
  };

  const { data: lineItems, error: itemError } = await admin
    .from("line_items")
    .select("id, description, description_es, quantity, unit_price")
    .eq("estimate_id", id);
  if (itemError) {
    console.error("Proposal line item lookup failed:", itemError.message);
    return NextResponse.json({ error: "Unable to load proposal details." }, { status: 500 });
  }

  const { data: attachments } = await admin.from("estimate_attachments")
    .select("id, storage_path, media_type").eq("estimate_id", id).eq("media_type", "photo");
  const photos = await Promise.all((attachments ?? []).map(async (attachment) => {
    const { data } = await admin.storage.from("estimate-media").createSignedUrl(attachment.storage_path, 60 * 60);
    return data?.signedUrl ? { id: attachment.id, url: data.signedUrl } : null;
  }));

  const { user_id: _privateOwnerId, converted_job_id: _privateJobId, ...publicEstimate } = estimate;
  return NextResponse.json({ estimate: publicEstimate, converted: Boolean(_privateJobId), lineItems: lineItems ?? [], contractor, photos: photos.filter(Boolean) }, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

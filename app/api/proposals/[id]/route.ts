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
    .select("id, client_name, client_email, client_phone, job_address, status, require_deposit, deposit_percentage, created_at, package_options, signature_name, selected_package, accepted_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Proposal lookup failed:", error.message);
    return NextResponse.json({ error: "Unable to load this proposal." }, { status: 500 });
  }
  if (!estimate) return NextResponse.json({ error: "Proposal not found or link expired." }, { status: 404 });

  const { data: lineItems, error: itemError } = await admin
    .from("line_items")
    .select("id, description, quantity, unit_price")
    .eq("estimate_id", id);
  if (itemError) {
    console.error("Proposal line item lookup failed:", itemError.message);
    return NextResponse.json({ error: "Unable to load proposal details." }, { status: 500 });
  }

  return NextResponse.json({ estimate, lineItems: lineItems ?? [] }, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

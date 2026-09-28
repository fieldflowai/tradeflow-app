import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ error: "Proposal approval is not configured." }, { status: 503 });
  const { id } = await params;
  const body = await request.json();
  const signatureName = typeof body.signatureName === "string" ? body.signatureName.trim().slice(0, 120) : "";
  const selectedPackage = typeof body.selectedPackage === "string" ? body.selectedPackage.slice(0, 40) : null;
  if (signatureName.length < 2) return NextResponse.json({ error: "Enter your full name to approve this estimate." }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });
  const { data: estimate, error: getError } = await admin.from("estimates").select("id, status, package_options").eq("id", id).single();
  if (getError || !estimate) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  if (["paid", "declined"].includes(String(estimate.status).toLowerCase())) return NextResponse.json({ error: "This estimate is no longer open for approval." }, { status: 409 });
  const options = Array.isArray(estimate.package_options) ? estimate.package_options as Array<{ name: string }> : [];
  if (options.length && !selectedPackage) return NextResponse.json({ error: "Choose a proposal option before approval." }, { status: 400 });
  if (selectedPackage && !options.some((option) => option.name === selectedPackage)) return NextResponse.json({ error: "The selected proposal option is not available." }, { status: 400 });

  const { error: updateError } = await admin.from("estimates").update({ signature_name: signatureName, selected_package: selectedPackage, accepted_at: new Date().toISOString(), status: "accepted" }).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

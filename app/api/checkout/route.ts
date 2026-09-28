import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export async function POST(req: Request) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe API key is missing from environment variables." },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16" as any,
    });

    const body = await req.json();
    const { estimateId, selectedPackage } = body;

    if (!estimateId) {
      return NextResponse.json(
        { error: "Missing estimate ID." },
        { status: 400 }
      );
    }

    const { data: estimate, error: estimateError } = await supabase.from("estimates").select("id, client_name, client_email, job_address, require_deposit, deposit_percentage, package_options, selected_package").eq("id", estimateId).single();
    if (estimateError || !estimate) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
    const { data: lines, error: linesError } = await supabase.from("line_items").select("quantity, unit_price").eq("estimate_id", estimateId);
    if (linesError) return NextResponse.json({ error: linesError.message }, { status: 500 });
    const baseTotal = (lines ?? []).reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0);
    const packages = Array.isArray(estimate.package_options) ? estimate.package_options as Array<{ name: string; total: number }> : [];
    if (selectedPackage && estimate.selected_package && selectedPackage !== estimate.selected_package) return NextResponse.json({ error: "The selected option does not match the approved proposal." }, { status: 409 });
    const approvedPackage = estimate.selected_package || selectedPackage || null;
    const option = approvedPackage ? packages.find((item) => item.name === approvedPackage) : null;
    if (approvedPackage && !option) return NextResponse.json({ error: "Selected proposal option was not found." }, { status: 400 });
    const estimateTotal = option ? Number(option.total) : baseTotal;
    const amount = estimate.require_deposit ? estimateTotal * (Number(estimate.deposit_percentage || 0) / 100) : estimateTotal;
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "The estimate total must be greater than zero before checkout." }, { status: 400 });

    const origin = req.headers.get("origin") || "http://localhost:3000";

    // Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Required Job Deposit`,
              description: `${approvedPackage ? `${approvedPackage} option · ` : ""}Deposit for ${estimate.job_address || "service request"}`,
            },
            unit_amount: Math.round(amount * 100), // Stripe expects amounts in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: estimate.client_email || undefined,
      metadata: {
        estimateId: estimateId,
        selectedPackage: approvedPackage || "",
      },
      success_url: `${origin}/estimate/${estimateId}?payment=success`,
      cancel_url: `${origin}/estimate/${estimateId}?payment=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe Session Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

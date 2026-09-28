import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeKey || !webhookSecret || !serviceRoleKey) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const stripe = new Stripe(stripeKey);
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid signature." }, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { persistSession: false } });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const estimateId = session.metadata?.estimateId;
    if (estimateId) {
      const { error } = await admin.from("estimates").update({ status: "paid" }).eq("id", estimateId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const userId = session.client_reference_id || session.metadata?.user_id;
    if (session.mode === "subscription" && userId && session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
      const { error } = await admin.from("subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: String(session.customer),
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata.user_id;
    if (!userId) return NextResponse.json({ received: true, ignored: "subscription has no TradeFlow user metadata" });
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const { error } = await admin.from("subscriptions").upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

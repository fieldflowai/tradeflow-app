import Stripe from "stripe";
import { NextResponse } from "next/server";
import { finishAudit, requireTradeFlowAdmin, sameOrigin, startAudit, validReason } from "@/lib/admin-support";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const access = await requireTradeFlowAdmin("billing");
  if ("response" in access) return access.response;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return NextResponse.json({ error: "Stripe billing support is not configured." }, { status: 503 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const couponId = typeof body.coupon_id === "string" ? body.coupon_id.trim() : "";
  if (!couponId || couponId.length > 120) return NextResponse.json({ error: "Enter a valid Stripe coupon ID." }, { status: 400 });
  if (!validReason(body.reason)) return NextResponse.json({ error: "Provide a billing reason of at least 8 characters." }, { status: 400 });

  const [{ data: target, error: targetError }, { data: subscription, error: subscriptionError }] = await Promise.all([
    access.admin.auth.admin.getUserById(id),
    access.admin.from("subscriptions").select("status, stripe_subscription_id").eq("user_id", id).maybeSingle(),
  ]);
  if (targetError || !target.user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (subscriptionError) return NextResponse.json({ error: "Could not read the account subscription." }, { status: 502 });
  if (!subscription?.stripe_subscription_id || !["active", "trialing"].includes(subscription.status)) {
    return NextResponse.json({ error: "This account has no active Stripe subscription to discount." }, { status: 409 });
  }

  const stripe = new Stripe(stripeKey);
  let coupon: Stripe.Coupon;
  try {
    coupon = await stripe.coupons.retrieve(couponId);
  } catch {
    return NextResponse.json({ error: "Stripe could not find that coupon." }, { status: 404 });
  }
  if (!coupon.valid || coupon.percent_off !== 100 || coupon.duration === "forever" || (coupon.duration === "repeating" && (!coupon.duration_in_months || coupon.duration_in_months > 3))) {
    return NextResponse.json({ error: "Use a valid 100% off coupon that lasts once or no more than 3 months. Create or verify the coupon in Stripe first." }, { status: 400 });
  }

  let auditId: string;
  try {
    auditId = await startAudit(access.admin, access.user.id, id, "billing_coupon_applied", body.reason, {
      coupon_id: coupon.id,
      coupon_duration: coupon.duration,
      duration_in_months: coupon.duration_in_months ?? null,
      percent_off: coupon.percent_off,
    }, access.user.email);
  } catch {
    return NextResponse.json({ error: "Could not write the required billing audit entry." }, { status: 503 });
  }
  try {
    await stripe.subscriptions.update(subscription.stripe_subscription_id, { discounts: [{ coupon: coupon.id }] });
    await finishAudit(access.admin, auditId, "succeeded");
    return NextResponse.json({ success: true, message: `Applied ${coupon.name || coupon.id} to the Stripe subscription.` });
  } catch (error) {
    await finishAudit(access.admin, auditId, "failed");
    console.error("Admin billing coupon application failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Stripe could not apply that coupon." }, { status: 502 });
  }
}

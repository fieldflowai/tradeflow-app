import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured.");
  return new Stripe(key);
}

export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Payment storage is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function getAppOrigin(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
}

export function getCardPaymentsState(account: Stripe.V2.Core.Account) {
  const cardStatus = account.configuration?.merchant?.capabilities?.card_payments?.status;
  const requirements = account.requirements?.entries ?? [];
  return {
    chargesEnabled: account.configuration?.merchant?.applied === true && cardStatus === "active",
    requirementsDue: requirements.length > 0,
  };
}

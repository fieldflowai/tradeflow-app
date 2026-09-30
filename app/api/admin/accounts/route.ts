import { NextResponse } from "next/server";
import { requireTradeFlowAdmin } from "@/lib/admin-support";

export async function GET(request: Request) {
  const access = await requireTradeFlowAdmin();
  if ("response" in access) return access.response;
  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (query.length < 3 || query.length > 120) return NextResponse.json({ error: "Enter at least 3 characters to search." }, { status: 400 });

  const matches: Array<{ id: string; email: string; created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null; business_name: string }> = [];
  const perPage = 1000;
  // The Auth Admin API is paginated but has no email-search parameter. Bound this scan;
  // a searchable account directory can replace it if the customer base grows materially.
  for (let page = 1; page <= 20 && matches.length < 40; page += 1) {
    const { data, error } = await access.admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("Admin account search failed:", error.message);
      return NextResponse.json({ error: "Could not search accounts." }, { status: 502 });
    }
    for (const user of data.users) {
      const email = user.email?.toLowerCase() ?? "";
      const businessName = typeof user.user_metadata?.business_name === "string" ? user.user_metadata.business_name : "";
      if (email.includes(query) || businessName.toLowerCase().includes(query)) {
        matches.push({ id: user.id, email: user.email ?? "", created_at: user.created_at, last_sign_in_at: user.last_sign_in_at ?? null, email_confirmed_at: user.email_confirmed_at ?? null, business_name: businessName });
        if (matches.length >= 40) break;
      }
    }
    if (data.users.length < perPage) break;
  }

  if (!matches.length) return NextResponse.json({ accounts: [] });
  const ids = matches.map((account) => account.id);
  const { data: subscriptions, error: subscriptionError } = await access.admin
    .from("subscriptions").select("user_id, status, current_period_end, stripe_customer_id, stripe_subscription_id").in("user_id", ids);
  if (subscriptionError) {
    console.error("Admin subscription lookup failed:", subscriptionError.message);
    return NextResponse.json({ error: "Could not load billing status." }, { status: 502 });
  }
  const subscriptionByUser = new Map((subscriptions ?? []).map((row) => [row.user_id, row]));
  return NextResponse.json({ accounts: matches.map((account) => {
    const subscription = subscriptionByUser.get(account.id);
    return {
      ...account,
      plan_status: subscription?.status ?? "free",
      current_period_end: subscription?.current_period_end ?? null,
      has_stripe_customer: Boolean(subscription?.stripe_customer_id),
      has_stripe_subscription: Boolean(subscription?.stripe_subscription_id),
    };
  }) }, { headers: { "Cache-Control": "no-store" } });
}

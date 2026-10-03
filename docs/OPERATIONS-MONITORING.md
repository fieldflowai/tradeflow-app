# WorkCraft AI monitoring and incident checklist

This guide records the monitoring baseline and the low-cost setup to complete. The chosen alert/contact address is `support@workcraftai.com`. It is intentionally read-only: it does not change provider billing, production settings, or customer data.

## Health checks

- App availability and Supabase Auth readiness: `https://app.workcraftai.com/api/health`. HTTP 200 means the app handler and Supabase Auth health endpoint responded; HTTP 503 means Supabase Auth is missing configuration or did not respond successfully. The response contains no credentials or provider error text.
- Marketing site availability: monitor `https://workcraftai.com/` for HTTP 200. The marketing site is a separate static Vercel project, so the app's `/api/health` cannot report on it.
- A GitHub Actions workflow checks both endpoints every 15 minutes and can also be run manually. Scheduled runs only begin after the workflow reaches the repository's default branch. GitHub may delay or drop scheduled runs during high load, so treat this as a low-cost first layer rather than a guaranteed paging service.
- These checks do not verify login, database queries/RLS, Stripe checkout/webhooks, or sending email. Keep the existing manual smoke check for those flows.

## Provider notifications to enable

| Provider | Watch | Where / action |
| --- | --- | --- |
| Vercel | Failed production deploys, function error anomalies, usage increases and limit thresholds | Team notification settings and project usage page. Configure usage thresholds if the plan exposes them; do not enable automatic project pausing without a deliberate decision. |
| Supabase Production | Database size, storage, egress, Auth/API health, and billing/usage | Project Usage and Billing pages; set project spend cap if the current plan offers it. Review database/storage usage weekly while testing. |
| Stripe | Failed webhook deliveries, payment/subscription events, and account notices | WorkCraft AI Stripe Dashboard → Developers → Webhooks and Workbench/Events. **Production currently has no live webhook endpoint**, though the app relies on `/api/webhooks/stripe` to synchronize subscription state. Add and verify it before relying on automatic subscription updates. |
| Resend | Daily/monthly email quota, sending errors, bounces and complaints | Account Usage and email logs. Domain `workcraftai.com` is verified. Two old 403 send attempts predate verification; the latest usage snapshot showed no current sends, so verify with a real, controlled test email after a monitored sender is configured. |

Provider alert features and thresholds depend on the account plan. Review the current plan screens before relying on a threshold; do not enable paid upgrades or spend controls without deciding the budget first.

## Abuse and cost controls

The highest direct variable-cost route found is authenticated Pro cloud estimate generation (`POST /api/generate-estimate`), which calls Gemini. It caps prompt length and output line count but has no durable per-user usage quota or rate limiter. The current logs show too little traffic to make anomaly monitoring meaningful.

The app now has a prepared database-backed, atomic daily estimate-creation cap for free accounts, initially 10 saved estimates per UTC day. It is separate from the Pro Gemini request allowance and from provider spend limits. The implementation, tests, and migration/release steps are documented in `docs/FREE-ESTIMATE-LIMIT.md`; the migration still needs review and a deliberate deployment before enforcement is active.

Review Vercel function invocations and errors, Supabase Auth/API logs, and Gemini usage at least weekly during the friends-and-family test. Investigate sudden traffic spikes, repeated 401/403/429 responses, high function duration, elevated database connections, or an unexpected jump in Gemini usage. Never put prompts, email addresses, access tokens, or API keys in monitoring logs.

## Current baseline (2026-10-03)

- Vercel Production app and both Supabase projects reported healthy during the audit; the app had no runtime errors in the preceding seven days. Traffic was very low, so this is not a useful abuse baseline yet.
- Resend reports the production domain verified and sending enabled; current usage was 0/100 daily and 0/3,000 monthly at the audit. Two older 403 attempts were logged before domain verification.
- Stripe Live had no webhook endpoint configured. Subscription synchronization is therefore an operational gap and must be corrected before trusting subscription state changes.
- The repository is public; the GitHub Actions checks use standard public runners and no secrets. No dedicated external uptime provider or alert destination has been configured.

## First-response checklist

1. Confirm the alert by opening the relevant public URL and provider status page.
2. For app health failures, check Vercel Production deployment/runtime logs, then Supabase project status and Auth/API logs.
3. For email problems, check Resend domain status, account usage, and the specific email's delivery event.
4. For billing/subscription problems, check Stripe Live event delivery and the `/api/webhooks/stripe` response before changing subscription records.
5. If abuse is suspected, preserve timestamps and aggregate request counts, restrict the affected integration through its own provider controls, and rotate a credential only if exposure is indicated. Do not export customer content into incident notes.

## Setup still needed

- Configure provider notifications to reach `support@workcraftai.com` where the provider supports a custom recipient. `NEXT_PUBLIC_SUPPORT_EMAIL` controls the app's public support link only; setting it does not route Vercel, Supabase, GitHub, or Resend alerts to that inbox.
- Enable GitHub Actions notifications for failed workflow runs (Profile → Settings → Notifications → Actions). GitHub sends these to the notification email configured on the GitHub account that owns the workflow; the workflow itself cannot route them to `support@workcraftai.com` without a configured mail integration/secret. GitHub documents that scheduled workflows can be delayed or dropped during high load.
- Configure a commercial-use uptime provider if faster or more reliable paging is needed.
- Enable provider-native usage/error notifications and confirm they reach the chosen destination.
- Configure the live Stripe webhook and validate a test-mode flow and a production event delivery.
- Decide whether a separate Gemini per-user allowance is needed; the estimate-creation cap does not meter Pro AI requests.
- After setup, trigger a controlled test alert and confirm end-to-end delivery to the chosen channel.

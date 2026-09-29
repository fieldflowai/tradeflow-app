This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## TradeFlow business features

The app includes contractor price books and estimate templates, a scheduled job board with status tracking and actual job costs, estimate and job reports with gross profit, printable proposals/invoices, customer approval capture, Good/Better/Best proposal options, Pro subscriptions, cloud estimate drafting, branded estimate email, and automatic follow-up scheduling.

### Supabase setup

Apply [`supabase/migrations/202609270001_tradeflow_operations.sql`](supabase/migrations/202609270001_tradeflow_operations.sql) to the Supabase project before using the new price book, templates, jobs, reporting, subscription, and email tracking features. The migration adds row-level policies for the new user-owned tables and extra columns to the existing `estimates` table.

### Pro integrations

Copy `.env.example` to `.env.local` and set the values for integrations you enable:

- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET`. Point the Stripe webhook at `/api/webhooks/stripe` and subscribe it to checkout completion and subscription update/deletion events.
- Cloud estimate drafts: `GEMINI_API_KEY` (optionally set `GEMINI_MODEL`). The Gemini key stays server-side.
- Branded email and follow-ups: `RESEND_API_KEY` and `RESEND_FROM_EMAIL`, using a sender domain verified with Resend.
- Scheduled follow-ups: configure a scheduler to POST `/api/cron/followups` with `Authorization: Bearer <CRON_SECRET>`. The app schedules a follow-up seven days after sending an estimate email; the scheduler runs due messages.
- Set `SUPABASE_SERVICE_ROLE_KEY` for signed customer approvals, proposal view tracking, Stripe webhooks, and the follow-up worker. Keep this key private and server-side.

The app reads subscription state from Stripe webhook updates. Pro tools stay locked until the webhook records an active or trialing subscription.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

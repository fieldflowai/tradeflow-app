# WorkCraft AI plans and feature boundaries

This is the source-of-truth feature matrix for the app and public pricing page.

| Feature | Free | Pro ($9.99/month) |
| --- | --- | --- |
| Saved estimates | 10 new estimates per UTC day | Unlimited |
| Estimate drafting | Local Smart Assistant and the user's price book | Cloud AI drafting matched to the user's price book |
| Price book and reusable estimate templates | Included | Included |
| Customer proposal links, review, and approval | Included | Included |
| Customer proposal questions | Saved in the app; no contractor email alert | Saved in the app with contractor email alert |
| Basic estimate pipeline and acceptance reports | Included | Included |
| Branded proposal email and automated follow-ups | Not included | Included |
| Estimate photos and voice-note cloud storage | Not included | Included |
| Job scheduling, job tracking, actual costs, and invoice status | Not included | Included |
| Job-value and gross-profit report metrics | Not included | Included |
| Good / Better / Best package options and proposal deposit terms | Not included | Included |
| Customer invoice payments through Stripe | Not available yet | Not available yet |

Free estimates use local price-book rates and local guidance. Pro cloud AI, estimate email, follow-ups, and proposal-question email alerts make provider-backed calls and require an active or trialing subscription. A saved estimate is counted when its database row is successfully created; the quota is atomic and resets at 00:00 UTC. Failed inserts do not consume quota.

Jobs, invoices, and uploaded estimate media remain in the database/storage if a Pro subscription ends. Owners retain read access to those records and can use them again if Pro is reactivated; database row-level security blocks free-tier writes to job/invoice data, new estimate attachments, and storage uploads. The database also blocks free-tier changes that enable deposit terms or package options.

Pro checkout and subscription management are available from **Profile & Preferences → Your plan**. The marketing site's plan links lead to app signup; customers can create a free account and upgrade from Profile. Pro has no separate trial requirement.

The public support form remains available to prospective customers and is protected by request size checks, origin validation, a honeypot, and IP-based rate limits. Those business-support messages are operational overhead rather than an app tier feature.

## Payment collection status

WorkCraft AI Pro is sold through Stripe subscriptions. Contractor-to-customer invoice payment collection using Stripe Connect has not been implemented. Deposit settings describe proposal terms only; they do not charge customers. Do not advertise customer payment collection until Connect onboarding, connected-account payments, webhook reconciliation, refunds/disputes, and production verification are implemented.

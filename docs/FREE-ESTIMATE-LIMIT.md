# Free estimate daily limit

## User-facing behavior

- New estimate records saved by a free account count toward a configurable per-user limit. The initial value is **10 per UTC calendar day**. There was no server-side free estimate cap before this feature; 10 is a generous starting allowance for testing and can be adjusted in Admin support.
- A persisted estimate counts as soon as its `estimates` row is inserted, including a pending estimate whose later line-item or attachment upload fails. The failed later step does not remove the estimate or restore its allowance; the user should reopen that estimate and finish it instead of creating a duplicate.
- Unsaved browser/device drafts do not count. AI-generated text alone does not count; the generated-estimate endpoint is currently Pro-only, and any estimate saved from its result counts only if it is created by a free account.
- Editing an existing estimate does not count again. Deleting or archiving an estimate does not restore its allowance.
- Active and trialing Pro accounts are exempt. Accounts without a subscription row and other non-active statuses are treated as free.
- The daily allowance resets at **00:00 UTC**. This is one common boundary for all accounts and does not change for daylight saving time.
- A configured value of 0 pauses new free-tier estimate creation. The allowed range is 0–1,000.

## Enforcement and data safety

PostgreSQL checks the subscription and atomically increments a private per-user/day ledger in a `BEFORE INSERT` trigger. A unique `(user_id, usage_date)` row plus a conditional `INSERT ... ON CONFLICT DO UPDATE` serializes concurrent requests at the database row, including requests reaching separate Vercel instances. If the estimate insert statement fails, its ledger increment rolls back with it.

The private settings and usage tables have RLS enabled, no browser policies, and no `anon` or `authenticated` table grants. Only the server-side service role can inspect them. Existing estimate records are not rewritten or deleted. The migration backfills current UTC-day estimate counts for users who are free when it runs, avoiding a fresh allowance on rollout day.

Only the existing `super_admin` role can change this global setting, with MFA required by the admin console. The server validates the range and an audit reason. A service-role-only database function checks that role again and writes the setting plus the old/new values to `tradeflow_admin_audit_log` in one transaction.

## Migration and release

1. Review `supabase/migrations/20261003141347_free_estimate_daily_limit.sql` and the database tests.
2. Apply the migration to a non-production Supabase environment and run `supabase test db` plus `npm run test:db:quota-concurrency`.
3. Review CI lint, tests, typecheck, and build. The migration is intentionally not applied to production by this change.
4. After a deliberate release approval, apply the migration to production before deploying the app code. Until both are present, the existing create flow remains unchanged; the admin setting endpoint reports that the migration is needed.
5. Verify the initial setting is 10, test a free account at the limit, test a Pro account, and review one admin change in the audit log.

## Rollback

To stop enforcing the cap, drop `enforce_free_daily_estimate_limit_before_insert` and its trigger function. This leaves estimate records, the global setting, audit entries, and usage ledger intact for investigation or later re-enabling. Remove private tables only in a separately reviewed cleanup after confirming they are no longer needed; never delete or rewrite customer estimates as part of rollback.

## Checks

- `supabase/tests/database/free_estimate_limit.test.sql` covers RLS, role access, saved/edited estimate accounting, Pro exemption, validation, and audit details.
- `scripts/test-free-estimate-concurrency.mjs` creates a temporary local user, issues 20 concurrent estimate inserts against a test cap of 5, asserts that exactly 5 succeed, then restores the setting and deletes that user.

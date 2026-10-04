begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.stripe_connected_accounts'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.customer_payments'::regclass),
  'connected accounts and payment records have RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.customer_payments', 'SELECT')
  and not has_table_privilege('authenticated', 'public.customer_payments', 'INSERT')
  and has_table_privilege('service_role', 'public.customer_payments', 'INSERT'),
  'anonymous and browser clients cannot write payment records'
);
select ok(
  not has_function_privilege('authenticated', 'public.workcraft_prepare_customer_payment(uuid,uuid,text,bigint,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.workcraft_prepare_customer_payment(uuid,uuid,text,bigint,text)', 'EXECUTE'),
  'only the service role can prepare a checkout'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'customer_payments_one_pending_checkout_idx' and indexdef ilike '%where (status = ''pending''::text)%'),
  'only one pending checkout can exist per estimate'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a3000000-0000-4000-8000-000000000001', 'payments-free@example.test', '{}'),
  ('a3000000-0000-4000-8000-000000000002', 'payments-pro@example.test', '{}'),
  ('a3000000-0000-4000-8000-000000000003', 'payments-other@example.test', '{}');
insert into public.subscriptions (user_id, status) values ('a3000000-0000-4000-8000-000000000002', 'active');
insert into public.estimates (id, user_id, client_name, client_email, status, require_deposit, deposit_percentage)
values
  ('b3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'Free', 'free@example.test', 'accepted', false, 0),
  ('b3000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000002', 'Pro', 'pro@example.test', 'accepted', true, 30);

select throws_ok(
  $$insert into public.stripe_connected_accounts (user_id, stripe_account_id) values ('a3000000-0000-4000-8000-000000000001', 'acct_free')$$,
  '42501', 'WORKCRAFT_PRO_REQUIRED', 'free accounts cannot connect Stripe for customer payments'
);
select throws_ok(
  $$insert into public.customer_payments (user_id, estimate_id, stripe_account_id, payment_kind, amount_cents) values ('a3000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'acct_free', 'balance', 10000)$$,
  '42501', 'WORKCRAFT_PRO_REQUIRED', 'free accounts cannot create customer payment records'
);

insert into public.stripe_connected_accounts (user_id, stripe_account_id, charges_enabled, requirements_due)
values ('a3000000-0000-4000-8000-000000000002', 'acct_pro_test', true, false);
set local role service_role;
select is(
  (select payment_id from public.workcraft_prepare_customer_payment('a3000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000002', 'deposit', 3000, 'acct_pro_test')),
  (select id from public.customer_payments where estimate_id = 'b3000000-0000-4000-8000-000000000002'),
  'the checkout procedure creates a pending payment for the authorized estimate'
);
select is(
  (select reused from public.workcraft_prepare_customer_payment('a3000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000002', 'deposit', 3000, 'acct_pro_test')),
  true,
  'repeated requests reuse the pending checkout instead of creating duplicates'
);
select throws_ok(
  $$select * from public.workcraft_prepare_customer_payment('a3000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000001', 'balance', 10000, 'acct_pro_test')$$,
  '42501', 'ESTIMATE_NOT_PAYABLE', 'a contractor cannot collect against another user’s estimate'
);
select throws_ok(
  $$select * from public.workcraft_prepare_customer_payment('a3000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'balance', 10000, 'acct_free')$$,
  '42501', 'WORKCRAFT_PRO_REQUIRED', 'the checkout procedure enforces Pro access'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub = 'a3000000-0000-4000-8000-000000000002';
select is((select count(*) from public.customer_payments), 1::bigint, 'contractors can see their own payment records');
set local request.jwt.claim.sub = 'a3000000-0000-4000-8000-000000000003';
select is((select count(*) from public.customer_payments), 0::bigint, 'other contractors cannot read payment records');

select * from finish();
rollback;

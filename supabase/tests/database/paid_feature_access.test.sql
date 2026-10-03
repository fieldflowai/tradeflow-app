begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select ok(
  not has_function_privilege('authenticated', 'public.workcraft_user_has_pro(uuid)', 'EXECUTE'),
  'the internal subscription helper is not callable directly by browser users'
);
select ok(
  exists (select 1 from pg_trigger where tgrelid = 'public.estimates'::regclass and tgname = 'enforce_pro_estimate_options' and not tgisinternal),
  'premium estimate options are guarded by a database trigger'
);
select ok(
  (select column_default ilike '%false%' from information_schema.columns where table_schema = 'public' and table_name = 'estimates' and column_name = 'require_deposit'),
  'new estimates default to no deposit requirement'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a2000000-0000-4000-8000-000000000001', 'paid-gate-free@example.test', '{}'),
  ('a2000000-0000-4000-8000-000000000002', 'paid-gate-pro@example.test', '{}');
insert into public.subscriptions (user_id, status)
values ('a2000000-0000-4000-8000-000000000002', 'active');
insert into public.estimates (id, user_id, client_name, client_email, require_deposit)
values ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Free historic job', 'free@example.test', false);
insert into public.estimates (id, user_id, client_name, client_email, require_deposit)
values ('b2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'Pro estimate', 'pro@example.test', false);
insert into public.jobs (id, user_id, title)
values ('c2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Historic job');

set local role authenticated;
set local request.jwt.claim.sub = 'a2000000-0000-4000-8000-000000000001';
select throws_ok(
  $$insert into public.estimates (user_id, client_name, client_email, require_deposit) values (auth.uid(), 'Free deposit', 'free@example.test', true)$$,
  '42501', 'WORKCRAFT_PRO_REQUIRED', 'free users cannot enable deposit terms by writing directly to Supabase'
);
select throws_ok(
  $$insert into public.estimates (user_id, client_name, client_email, package_options) values (auth.uid(), 'Free packages', 'free@example.test', '[{"name":"Good","total":100}]')$$,
  '42501', 'WORKCRAFT_PRO_REQUIRED', 'free users cannot enable packages by writing directly to Supabase'
);
select throws_ok(
  $$insert into public.estimate_attachments (estimate_id, user_id, storage_path, media_type, content_type) values ('b2000000-0000-4000-8000-000000000001', auth.uid(), 'free/path.jpg', 'photo', 'image/jpeg')$$,
  '42501', 'new row violates row-level security policy for table "estimate_attachments"', 'free users cannot attach media metadata'
);
select results_eq('select count(*) from public.jobs', array[1::bigint], 'free users retain read access to their existing job data');
select throws_ok(
  $$insert into public.jobs (user_id, title) values (auth.uid(), 'New free job')$$,
  '42501', 'new row violates row-level security policy for table "jobs"', 'free users cannot create jobs'
);

set local request.jwt.claim.sub = 'a2000000-0000-4000-8000-000000000002';
select lives_ok(
  $$insert into public.jobs (user_id, title) values (auth.uid(), 'Pro job')$$,
  'active Pro users can create jobs'
);
select lives_ok(
  $$insert into public.estimate_attachments (estimate_id, user_id, storage_path, media_type, content_type) values ('b2000000-0000-4000-8000-000000000002', auth.uid(), 'pro/path.jpg', 'photo', 'image/jpeg')$$,
  'active Pro users can add estimate media metadata'
);

select * from finish();
rollback;

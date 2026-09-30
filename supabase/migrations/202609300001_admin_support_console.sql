-- Internal TradeFlow support tools. No browser role receives direct access to these tables.
create table if not exists public.tradeflow_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('support', 'billing', 'super_admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null
);
alter table public.tradeflow_admins enable row level security;

create table if not exists public.tradeflow_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 1 and 80),
  reason text not null check (length(reason) between 8 and 500),
  details jsonb not null default '{}'::jsonb,
  outcome text not null default 'started' check (outcome in ('started', 'succeeded', 'failed')),
  created_at timestamptz not null default now()
);
create index if not exists tradeflow_admin_audit_target_idx
  on public.tradeflow_admin_audit_log(target_user_id, created_at desc);
alter table public.tradeflow_admin_audit_log enable row level security;

create table if not exists public.tradeflow_support_notes (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  category text not null default 'support' check (category in ('support', 'bug_report', 'billing', 'email_delivery')),
  note text not null check (length(trim(note)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists tradeflow_support_notes_target_idx
  on public.tradeflow_support_notes(target_user_id, created_at desc);
alter table public.tradeflow_support_notes enable row level security;

-- Deliberately no authenticated/anon policies. Server handlers verify membership before
-- using the service-role client; the service-role key must stay private on the server.

-- After applying this migration, replace the email below with your exact Supabase Auth
-- email and run the statement in the SQL Editor to grant your account initial access.
-- insert into public.tradeflow_admins (user_id, email, role)
-- select id, lower(email), 'super_admin' from auth.users
-- where lower(email) = lower('your-auth-email@example.com')
-- on conflict (user_id) do update set email = excluded.email, role = 'super_admin';

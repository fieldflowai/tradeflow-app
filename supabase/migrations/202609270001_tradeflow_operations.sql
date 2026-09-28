-- TradeFlow business tools: reusable price book, estimate templates, and jobs.
-- Apply in the Supabase SQL editor or through the Supabase CLI before using these screens.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'free',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "Users can view their own subscription" on public.subscriptions;
create policy "Users can view their own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

create table if not exists public.estimate_email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  estimate_id text not null,
  recipient text not null default '',
  provider_email_id text,
  event text not null default 'sent',
  created_at timestamptz not null default now()
);
alter table public.estimate_email_events enable row level security;
drop policy if exists "Users view their estimate email events" on public.estimate_email_events;
create policy "Users view their estimate email events" on public.estimate_email_events
  for select using (auth.uid() = user_id);
drop policy if exists "Users record their estimate email events" on public.estimate_email_events;
create policy "Users record their estimate email events" on public.estimate_email_events
  for insert with check (auth.uid() = user_id);

alter table public.estimates
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists signature_name text,
  add column if not exists selected_package text,
  add column if not exists accepted_at timestamptz,
  add column if not exists proposal_viewed_at timestamptz,
  add column if not exists followup_at timestamptz,
  add column if not exists followup_sent_at timestamptz;

create table if not exists public.price_book_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  trade text not null default 'General',
  unit text not null default 'each',
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists price_book_items_user_id_idx on public.price_book_items(user_id);
alter table public.price_book_items enable row level security;
drop policy if exists "Users manage their own price book" on public.price_book_items;
create policy "Users manage their own price book" on public.price_book_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.estimate_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  trade text not null default 'General',
  line_items jsonb not null default '[]'::jsonb,
  package_options jsonb not null default '[]'::jsonb,
  require_deposit boolean not null default false,
  deposit_percentage numeric(5,2) not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_templates_user_id_idx on public.estimate_templates(user_id);
alter table public.estimate_templates enable row level security;
drop policy if exists "Users manage their own estimate templates" on public.estimate_templates;
create policy "Users manage their own estimate templates" on public.estimate_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  estimate_id text,
  title text not null,
  client_name text not null default '',
  client_email text not null default '',
  job_address text not null default '',
  scheduled_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  invoice_status text not null default 'draft'
    check (invoice_status in ('draft', 'sent', 'paid')),
  notes text not null default '',
  quoted_total numeric(12,2) not null default 0 check (quoted_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_user_schedule_idx on public.jobs(user_id, scheduled_at);
create index if not exists jobs_user_status_idx on public.jobs(user_id, status);
alter table public.jobs enable row level security;
drop policy if exists "Users manage their own jobs" on public.jobs;
create policy "Users manage their own jobs" on public.jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.estimates
  add column if not exists trade text not null default 'General',
  add column if not exists package_options jsonb not null default '[]'::jsonb;

-- Configurable UTC-day cap for new estimates created by free accounts.
-- Existing estimate records remain intact; this ledger contains counters only.

create table public.tradeflow_app_settings (
  singleton boolean primary key default true check (singleton),
  free_daily_estimate_limit integer not null default 10
    check (free_daily_estimate_limit between 0 and 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.tradeflow_app_settings (singleton, free_daily_estimate_limit)
values (true, 10)
on conflict (singleton) do nothing;

create table public.tradeflow_daily_estimate_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  estimates_created integer not null check (estimates_created >= 0),
  primary key (user_id, usage_date)
);

alter table public.tradeflow_app_settings enable row level security;
alter table public.tradeflow_daily_estimate_usage enable row level security;
revoke all on public.tradeflow_app_settings, public.tradeflow_daily_estimate_usage from anon, authenticated;
grant all on public.tradeflow_app_settings, public.tradeflow_daily_estimate_usage to service_role;

-- Count estimates already created today before the trigger becomes active so an
-- in-progress UTC day cannot be reset by deploying this feature.
lock table public.estimates in share row exclusive mode;
insert into public.tradeflow_daily_estimate_usage (user_id, usage_date, estimates_created)
select e.user_id, (now() at time zone 'UTC')::date, count(*)::integer
from public.estimates e
left join public.subscriptions s on s.user_id = e.user_id
where e.user_id is not null
  and e.created_at >= ((now() at time zone 'UTC')::date::timestamp at time zone 'UTC')
  and coalesce(s.status, 'free') not in ('active', 'trialing')
group by e.user_id
on conflict (user_id, usage_date) do update
set estimates_created = excluded.estimates_created;

create or replace function public.enforce_free_daily_estimate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_limit integer;
  used_count integer;
  current_status text;
  today_utc date := (pg_catalog.now() at time zone 'UTC')::date;
begin
  if new.user_id is null then
    return new;
  end if;

  select s.status into current_status
  from public.subscriptions s
  where s.user_id = new.user_id;

  if current_status in ('active', 'trialing') then
    return new;
  end if;

  select settings.free_daily_estimate_limit into current_limit
  from public.tradeflow_app_settings settings
  where settings.singleton = true
  for share;

  if current_limit is null then
    raise exception using errcode = '55000', message = 'FREE_DAILY_ESTIMATE_LIMIT_NOT_CONFIGURED';
  end if;
  if current_limit = 0 then
    raise exception using errcode = 'P0001', message = 'FREE_DAILY_ESTIMATE_LIMIT';
  end if;

  insert into public.tradeflow_daily_estimate_usage as daily_usage (user_id, usage_date, estimates_created)
  values (new.user_id, today_utc, 1)
  on conflict (user_id, usage_date) do update
    set estimates_created = daily_usage.estimates_created + 1
    where daily_usage.estimates_created < current_limit
  returning estimates_created into used_count;

  if not found then
    raise exception using errcode = 'P0001', message = 'FREE_DAILY_ESTIMATE_LIMIT';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_free_daily_estimate_limit() from public, anon, authenticated;

create trigger enforce_free_daily_estimate_limit_before_insert
before insert on public.estimates
for each row execute function public.enforce_free_daily_estimate_limit();

-- The service-role-only RPC updates the setting and audit log in one transaction.
create or replace function public.update_free_daily_estimate_limit(
  p_limit integer,
  p_actor_user_id uuid,
  p_actor_email text,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_limit integer;
begin
  if p_limit is null or p_limit < 0 or p_limit > 1000 then
    raise exception using errcode = '22023', message = 'Limit must be an integer from 0 to 1000.';
  end if;
  if p_reason is null or pg_catalog.length(pg_catalog.btrim(p_reason)) < 8 or pg_catalog.length(pg_catalog.btrim(p_reason)) > 500 then
    raise exception using errcode = '22023', message = 'Provide a reason between 8 and 500 characters.';
  end if;
  if not exists (
    select 1 from public.tradeflow_admins a
    where a.user_id = p_actor_user_id and a.role = 'super_admin'
  ) then
    raise exception using errcode = '42501', message = 'Super administrator access is required.';
  end if;

  select free_daily_estimate_limit into previous_limit
  from public.tradeflow_app_settings
  where singleton = true
  for update;

  update public.tradeflow_app_settings
  set free_daily_estimate_limit = p_limit,
      updated_at = pg_catalog.now(),
      updated_by = p_actor_user_id
  where singleton = true;

  insert into public.tradeflow_admin_audit_log (
    actor_user_id, actor_email, action, reason, details, outcome
  ) values (
    p_actor_user_id,
    p_actor_email,
    'free_estimate_limit_updated',
    pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object('previous_limit', previous_limit, 'new_limit', p_limit),
    'succeeded'
  );

  return p_limit;
end;
$$;

revoke all on function public.update_free_daily_estimate_limit(integer, uuid, text, text) from public, anon, authenticated;
grant execute on function public.update_free_daily_estimate_limit(integer, uuid, text, text) to service_role;

comment on table public.tradeflow_app_settings is 'Private WorkCraft AI global product settings.';
comment on column public.tradeflow_app_settings.free_daily_estimate_limit is 'Maximum newly inserted estimates per free user per UTC calendar day; seeded to 10.';
comment on table public.tradeflow_daily_estimate_usage is 'Private atomic per-user daily estimate usage counters; retained estimate rows are not changed.';

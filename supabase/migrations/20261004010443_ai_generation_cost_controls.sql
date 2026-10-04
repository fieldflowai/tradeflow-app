begin;

alter table public.tradeflow_app_settings
  add column ai_drafting_enabled boolean not null default true,
  add column ai_daily_generation_limit integer not null default 20
    check (ai_daily_generation_limit between 1 and 1000);

create table public.tradeflow_ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  attempts_started integer not null default 0 check (attempts_started >= 0),
  succeeded integer not null default 0 check (succeeded >= 0),
  failed integer not null default 0 check (failed >= 0),
  primary key (user_id, usage_date),
  check (succeeded + failed <= attempts_started)
);
create index tradeflow_ai_daily_usage_usage_date_idx on public.tradeflow_ai_daily_usage(usage_date);

create table public.tradeflow_ai_generation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  outcome text not null default 'started' check (outcome in ('started', 'succeeded', 'failed')),
  prompt_characters integer not null check (prompt_characters between 1 and 6000),
  model text not null check (length(model) between 1 and 100),
  provider_status integer check (provider_status between 100 and 599),
  generated_items integer check (generated_items between 0 and 40)
);

create index tradeflow_ai_generation_events_created_at_idx
  on public.tradeflow_ai_generation_events(created_at);

alter table public.tradeflow_ai_daily_usage enable row level security;
alter table public.tradeflow_ai_generation_events enable row level security;
revoke all on public.tradeflow_ai_daily_usage, public.tradeflow_ai_generation_events from anon, authenticated;
grant all on public.tradeflow_ai_daily_usage, public.tradeflow_ai_generation_events to service_role;

create or replace function public.reserve_workcraft_ai_generation(
  p_user_id uuid,
  p_prompt_characters integer,
  p_model text
)
returns table (allowed boolean, reason text, generation_id uuid, remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ai_enabled boolean;
  daily_limit integer;
  today_utc date := (pg_catalog.now() at time zone 'UTC')::date;
  used_count integer;
  plan_status text;
  new_generation_id uuid;
begin
  if p_user_id is null or p_prompt_characters is null or p_prompt_characters < 1 or p_prompt_characters > 6000
     or p_model is null or pg_catalog.length(p_model) < 1 or pg_catalog.length(p_model) > 100 then
    raise exception using errcode = '22023', message = 'Invalid AI generation reservation.';
  end if;

  select settings.ai_drafting_enabled, settings.ai_daily_generation_limit
  into ai_enabled, daily_limit
  from public.tradeflow_app_settings settings
  where settings.singleton = true;
  if daily_limit is null then
    raise exception using errcode = '55000', message = 'AI_GENERATION_SETTINGS_NOT_CONFIGURED';
  end if;
  if not ai_enabled then
    return query select false, 'paused'::text, null::uuid, 0;
    return;
  end if;

  select subscriptions.status into plan_status
  from public.subscriptions
  where user_id = p_user_id;
  if plan_status is null or plan_status not in ('active', 'trialing') then
    return query select false, 'pro_required'::text, null::uuid, 0;
    return;
  end if;

  delete from public.tradeflow_ai_generation_events
  where created_at < pg_catalog.now() - interval '90 days';
  delete from public.tradeflow_ai_daily_usage
  where usage_date < today_utc - 90;

  insert into public.tradeflow_ai_daily_usage as usage (user_id, usage_date, attempts_started)
  values (p_user_id, today_utc, 1)
  on conflict (user_id, usage_date) do update
    set attempts_started = usage.attempts_started + 1
    where usage.attempts_started < daily_limit
  returning attempts_started into used_count;

  if not found then
    return query select false, 'daily_limit'::text, null::uuid, 0;
    return;
  end if;

  insert into public.tradeflow_ai_generation_events(user_id, usage_date, prompt_characters, model)
  values (p_user_id, today_utc, p_prompt_characters, p_model)
  returning id into new_generation_id;

  return query select true, 'allowed'::text, new_generation_id, greatest(daily_limit - used_count, 0);
end;
$$;

create or replace function public.complete_workcraft_ai_generation(
  p_generation_id uuid,
  p_outcome text,
  p_provider_status integer,
  p_generated_items integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_user_id uuid;
  event_usage_date date;
begin
  if p_outcome not in ('succeeded', 'failed')
     or (p_provider_status is not null and p_provider_status not between 100 and 599)
     or (p_generated_items is not null and p_generated_items not between 0 and 40) then
    raise exception using errcode = '22023', message = 'Invalid AI generation completion.';
  end if;

  update public.tradeflow_ai_generation_events
  set outcome = p_outcome,
      completed_at = pg_catalog.now(),
      provider_status = p_provider_status,
      generated_items = p_generated_items
  where id = p_generation_id and outcome = 'started'
  returning user_id, usage_date into event_user_id, event_usage_date;

  if not found then return false; end if;

  if p_outcome = 'succeeded' then
    update public.tradeflow_ai_daily_usage
    set succeeded = succeeded + 1
    where user_id = event_user_id and usage_date = event_usage_date;
  else
    update public.tradeflow_ai_daily_usage
    set failed = failed + 1
    where user_id = event_user_id and usage_date = event_usage_date;
  end if;
  return true;
end;
$$;

create or replace function public.update_workcraft_ai_generation_settings(
  p_enabled boolean,
  p_daily_limit integer,
  p_actor_user_id uuid,
  p_actor_email text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_enabled boolean;
  previous_limit integer;
begin
  if p_enabled is null or p_daily_limit is null or p_daily_limit < 1 or p_daily_limit > 1000 then
    raise exception using errcode = '22023', message = 'The daily AI generation limit must be an integer from 1 to 1,000.';
  end if;
  if p_reason is null or pg_catalog.length(pg_catalog.btrim(p_reason)) < 8 or pg_catalog.length(pg_catalog.btrim(p_reason)) > 500 then
    raise exception using errcode = '22023', message = 'Provide a reason between 8 and 500 characters.';
  end if;
  if not exists (
    select 1 from public.tradeflow_admins admins
    where admins.user_id = p_actor_user_id and admins.role = 'super_admin'
  ) then
    raise exception using errcode = '42501', message = 'Super administrator access is required.';
  end if;

  select ai_drafting_enabled, ai_daily_generation_limit
  into previous_enabled, previous_limit
  from public.tradeflow_app_settings
  where singleton = true
  for update;

  update public.tradeflow_app_settings
  set ai_drafting_enabled = p_enabled,
      ai_daily_generation_limit = p_daily_limit,
      updated_at = pg_catalog.now(),
      updated_by = p_actor_user_id
  where singleton = true;

  insert into public.tradeflow_admin_audit_log(actor_user_id, actor_email, action, reason, details, outcome)
  values (
    p_actor_user_id, p_actor_email, 'ai_generation_settings_updated', pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'previous_enabled', previous_enabled,
      'enabled', p_enabled,
      'previous_daily_limit', previous_limit,
      'daily_limit', p_daily_limit
    ), 'succeeded'
  );

  return pg_catalog.jsonb_build_object('enabled', p_enabled, 'daily_limit', p_daily_limit);
end;
$$;

revoke all on function public.reserve_workcraft_ai_generation(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.complete_workcraft_ai_generation(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.update_workcraft_ai_generation_settings(boolean, integer, uuid, text, text) from public, anon, authenticated;
grant execute on function public.reserve_workcraft_ai_generation(uuid, integer, text) to service_role;
grant execute on function public.complete_workcraft_ai_generation(uuid, text, integer, integer) to service_role;
grant execute on function public.update_workcraft_ai_generation_settings(boolean, integer, uuid, text, text) to service_role;

comment on column public.tradeflow_app_settings.ai_daily_generation_limit is 'Maximum Gemini drafting attempts per Pro user per UTC calendar day; initially 20.';
comment on table public.tradeflow_ai_daily_usage is 'Private atomic UTC-day AI generation quota counters.';
comment on table public.tradeflow_ai_generation_events is 'Private AI usage metadata; stores no prompt or generated content.';

commit;

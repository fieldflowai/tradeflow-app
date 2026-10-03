-- Keep anonymous support form submissions from being used to flood the support inbox.
-- Only a keyed hash of the requester IP is stored, with one row per UTC day.
begin;

create table public.support_contact_rate_limits (
  requester_hash text not null check (requester_hash ~ '^[a-f0-9]{64}$'),
  usage_date date not null,
  submissions integer not null check (submissions between 1 and 5),
  primary key (requester_hash, usage_date)
);
create index support_contact_rate_limits_usage_date_idx
  on public.support_contact_rate_limits (usage_date);

alter table public.support_contact_rate_limits enable row level security;
revoke all on public.support_contact_rate_limits from anon, authenticated;
grant all on public.support_contact_rate_limits to service_role;

create or replace function public.consume_public_support_submission_limit(p_requester_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  today_utc date := (pg_catalog.now() at time zone 'UTC')::date;
  accepted_count integer;
begin
  if p_requester_hash is null or p_requester_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid support submission key.';
  end if;

  delete from public.support_contact_rate_limits where usage_date < today_utc - 30;

  insert into public.support_contact_rate_limits as daily_limit (requester_hash, usage_date, submissions)
  values (p_requester_hash, today_utc, 1)
  on conflict (requester_hash, usage_date) do update
    set submissions = daily_limit.submissions + 1
    where daily_limit.submissions < 5
  returning submissions into accepted_count;

  return found;
end;
$$;

revoke all on function public.consume_public_support_submission_limit(text) from public, anon, authenticated;
grant execute on function public.consume_public_support_submission_limit(text) to service_role;

comment on table public.support_contact_rate_limits is 'Private daily rate limits for the public support contact form; requester IPs are stored only as keyed hashes.';

commit;

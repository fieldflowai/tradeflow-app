-- Stripe direct-charge metadata and status ledger. Funds never enter the platform balance.
create table if not exists public.stripe_connected_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  requirements_due boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.stripe_connected_accounts enable row level security;
revoke all on public.stripe_connected_accounts from anon, authenticated;
grant all on public.stripe_connected_accounts to service_role;
grant select on public.stripe_connected_accounts to authenticated;
drop policy if exists "Contractors view their connected payment account" on public.stripe_connected_accounts;
create policy "Contractors view their connected payment account" on public.stripe_connected_accounts
  for select to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  stripe_account_id text not null,
  payment_kind text not null check (payment_kind in ('deposit', 'balance')),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'expired', 'refunded', 'partially_refunded')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  checkout_url text,
  amount_refunded_cents bigint not null default 0 check (amount_refunded_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_refunded_cents <= amount_cents)
);
create index if not exists customer_payments_estimate_idx on public.customer_payments(estimate_id, created_at desc);
create index if not exists customer_payments_user_idx on public.customer_payments(user_id, created_at desc);
create unique index if not exists customer_payments_one_pending_checkout_idx on public.customer_payments(estimate_id)
  where status = 'pending';
alter table public.customer_payments enable row level security;
revoke all on public.customer_payments from anon, authenticated;
grant all on public.customer_payments to service_role;
grant select on public.customer_payments to authenticated;
drop policy if exists "Contractors view their customer payment records" on public.customer_payments;
create policy "Contractors view their customer payment records" on public.customer_payments
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.workcraft_prepare_customer_payment(
  p_user_id uuid, p_estimate_id uuid, p_payment_kind text, p_amount_cents bigint, p_stripe_account_id text
)
returns table(payment_id uuid, reused boolean)
language plpgsql security definer set search_path = '' as $$
declare existing public.customer_payments%rowtype;
begin
  if p_payment_kind not in ('deposit', 'balance') or p_amount_cents <= 0 then
    raise exception using errcode = '22023', message = 'INVALID_PAYMENT_REQUEST';
  end if;
  if not public.workcraft_user_has_pro(p_user_id) then
    raise exception using errcode = '42501', message = 'WORKCRAFT_PRO_REQUIRED';
  end if;
  if not exists (select 1 from public.estimates e where e.id = p_estimate_id and e.user_id = p_user_id and e.status = 'accepted') then
    raise exception using errcode = '42501', message = 'ESTIMATE_NOT_PAYABLE';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_estimate_id::text, 0));
  select cp.* into existing from public.customer_payments cp
   where cp.estimate_id = p_estimate_id and cp.status = 'pending'
   order by cp.created_at desc limit 1;
  if found then
    return query select existing.id, true;
    return;
  end if;
  if (select count(*) from public.customer_payments cp
      where cp.estimate_id = p_estimate_id and cp.created_at >= pg_catalog.now() - interval '24 hours') >= 10 then
    raise exception using errcode = '54000', message = 'CHECKOUT_RATE_LIMITED';
  end if;
  insert into public.customer_payments(user_id, estimate_id, stripe_account_id, payment_kind, amount_cents)
  values (p_user_id, p_estimate_id, p_stripe_account_id, p_payment_kind, p_amount_cents)
  returning id into payment_id;
  reused := false;
  return next;
end;
$$;
revoke all on function public.workcraft_prepare_customer_payment(uuid, uuid, text, bigint, text) from public, anon, authenticated;
grant execute on function public.workcraft_prepare_customer_payment(uuid, uuid, text, bigint, text) to service_role;

create or replace function public.enforce_pro_connected_payment_setup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.workcraft_user_has_pro(new.user_id) then
    raise exception using errcode = '42501', message = 'WORKCRAFT_PRO_REQUIRED';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_pro_connected_payment_setup() from public, anon, authenticated;
drop trigger if exists enforce_pro_connected_payment_setup on public.stripe_connected_accounts;
create trigger enforce_pro_connected_payment_setup before insert on public.stripe_connected_accounts
for each row execute function public.enforce_pro_connected_payment_setup();

create or replace function public.enforce_pro_customer_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.workcraft_user_has_pro(new.user_id) then
    raise exception using errcode = '42501', message = 'WORKCRAFT_PRO_REQUIRED';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_pro_customer_payment() from public, anon, authenticated;
drop trigger if exists enforce_pro_customer_payment on public.customer_payments;
create trigger enforce_pro_customer_payment before insert on public.customer_payments
for each row execute function public.enforce_pro_customer_payment();

comment on table public.stripe_connected_accounts is 'Stripe Connect references for contractor accounts. Customer charges are direct charges on each account.';
comment on table public.customer_payments is 'Payment status ledger for direct customer charges made on contractor Stripe connected accounts.';

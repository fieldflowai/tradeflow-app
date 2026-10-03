-- Enforce paid-only writes in Postgres so browser clients cannot bypass UI gates.
-- Existing rows remain readable after a subscription lapses.
alter table public.estimates alter column require_deposit set default false;

create or replace function public.workcraft_user_has_pro(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.subscriptions s where s.user_id = p_user_id and s.status in ('active', 'trialing'));
$$;
revoke all on function public.workcraft_user_has_pro(uuid) from public, anon, authenticated;

create or replace function public.enforce_pro_estimate_options()
returns trigger language plpgsql security definer set search_path = '' as $$
declare changed_to_pro_options boolean;
begin
  if tg_op = 'INSERT' then
    changed_to_pro_options := new.require_deposit is true
      or coalesce(new.package_options, '[]'::jsonb) <> '[]'::jsonb;
  else
    changed_to_pro_options :=
      (new.require_deposit is true and old.require_deposit is distinct from new.require_deposit)
      or (old.require_deposit is true and new.deposit_percentage is distinct from old.deposit_percentage)
      or (coalesce(new.package_options, '[]'::jsonb) <> '[]'::jsonb
          and old.package_options is distinct from new.package_options);
  end if;
  if changed_to_pro_options and not public.workcraft_user_has_pro(new.user_id) then
    raise exception using errcode = '42501', message = 'WORKCRAFT_PRO_REQUIRED';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_pro_estimate_options() from public, anon, authenticated;
drop trigger if exists enforce_pro_estimate_options on public.estimates;
create trigger enforce_pro_estimate_options
before insert or update of require_deposit, deposit_percentage, package_options on public.estimates
for each row execute function public.enforce_pro_estimate_options();

-- Job and invoice data stays visible to its owner, while writes require Pro.
drop policy if exists "Users manage their own jobs" on public.jobs;
create policy "Users read their own jobs" on public.jobs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Pro users create their own jobs" on public.jobs for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.subscriptions s where s.user_id = (select auth.uid()) and s.status in ('active', 'trialing')
  ));
create policy "Pro users update their own jobs" on public.jobs for update to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.subscriptions s where s.user_id = (select auth.uid()) and s.status in ('active', 'trialing')
  )) with check ((select auth.uid()) = user_id and exists (
    select 1 from public.subscriptions s where s.user_id = (select auth.uid()) and s.status in ('active', 'trialing')
  ));
create policy "Pro users delete their own jobs" on public.jobs for delete to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.subscriptions s where s.user_id = (select auth.uid()) and s.status in ('active', 'trialing')
  ));

-- Existing attachments remain readable/deletable; new uploads and metadata need Pro.
drop policy if exists "Users manage attachments for their estimates" on public.estimate_attachments;
create policy "Users read their own estimate attachments" on public.estimate_attachments for select to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.estimates e where e.id::text = estimate_id and e.user_id = (select auth.uid())
  ));
create policy "Pro users add estimate attachments" on public.estimate_attachments for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (select 1 from public.subscriptions s
    where s.user_id = (select auth.uid()) and s.status in ('active', 'trialing')) and exists (
    select 1 from public.estimates e where e.id::text = estimate_id and e.user_id = (select auth.uid())
  ));
create policy "Pro users update estimate attachments" on public.estimate_attachments for update to authenticated
  using ((select auth.uid()) = user_id and exists (select 1 from public.subscriptions s
    where s.user_id = (select auth.uid()) and s.status in ('active', 'trialing')))
  with check ((select auth.uid()) = user_id and exists (select 1 from public.subscriptions s
    where s.user_id = (select auth.uid()) and s.status in ('active', 'trialing')) and exists (
    select 1 from public.estimates e where e.id::text = estimate_id and e.user_id = (select auth.uid())
  ));
create policy "Users delete their own estimate attachments" on public.estimate_attachments for delete to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.estimates e where e.id::text = estimate_id and e.user_id = (select auth.uid())
  ));

drop policy if exists "Users upload their own estimate media" on storage.objects;
create policy "Pro users upload their own estimate media" on storage.objects for insert to authenticated
  with check (bucket_id = 'estimate-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.subscriptions s
      where s.user_id = (select auth.uid()) and s.status in ('active', 'trialing')));

comment on function public.workcraft_user_has_pro(uuid) is 'Checks active/trialing plan status for database-enforced Pro feature policies.';

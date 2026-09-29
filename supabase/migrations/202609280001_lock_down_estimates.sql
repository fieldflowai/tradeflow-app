-- Restrict estimates and line items to their owning contractor.
-- Public proposal links are served through /api/proposals using the service role.
alter table public.estimates enable row level security;
alter table public.line_items enable row level security;

revoke all on public.estimates, public.line_items from anon;
grant select, insert, update, delete on public.estimates, public.line_items to authenticated;
grant all on public.estimates, public.line_items to service_role;

do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and tablename in ('estimates', 'line_items')
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

create policy "Contractors manage their own estimates"
  on public.estimates for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Contractors manage line items for their estimates"
  on public.line_items for all to authenticated
  using (
    exists (
      select 1 from public.estimates e
      where e.id = line_items.estimate_id and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.estimates e
      where e.id = line_items.estimate_id and e.user_id = auth.uid()
    )
  );

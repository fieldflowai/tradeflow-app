-- Production hardening: explicitly limit internal admin tables to server-side access,
-- avoid per-row auth.uid() evaluation in RLS policies, and cover foreign keys.
revoke all on table
  public.tradeflow_admins,
  public.tradeflow_admin_audit_log,
  public.tradeflow_support_notes
from anon, authenticated;

drop policy if exists "Users can view their own subscription" on public.subscriptions;
create policy "Users can view their own subscription" on public.subscriptions
  for select using ((select auth.uid()) = user_id);

drop policy if exists "Users view their estimate email events" on public.estimate_email_events;
create policy "Users view their estimate email events" on public.estimate_email_events
  for select using ((select auth.uid()) = user_id);
drop policy if exists "Users record their estimate email events" on public.estimate_email_events;
create policy "Users record their estimate email events" on public.estimate_email_events
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own price book" on public.price_book_items;
create policy "Users manage their own price book" on public.price_book_items
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own estimate templates" on public.estimate_templates;
create policy "Users manage their own estimate templates" on public.estimate_templates
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own jobs" on public.jobs;
create policy "Users manage their own jobs" on public.jobs
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Contractors manage their own estimates" on public.estimates;
create policy "Contractors manage their own estimates"
  on public.estimates for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Contractors manage line items for their estimates" on public.line_items;
create policy "Contractors manage line items for their estimates"
  on public.line_items for all to authenticated
  using (exists (
    select 1 from public.estimates e
    where e.id = line_items.estimate_id and e.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.estimates e
    where e.id = line_items.estimate_id and e.user_id = (select auth.uid())
  ));

drop policy if exists "Contractors read their proposal questions" on public.proposal_questions;
create policy "Contractors read their proposal questions" on public.proposal_questions
  for select using ((select auth.uid()) = user_id);
drop policy if exists "Contractors mark their proposal questions read" on public.proposal_questions;
create policy "Contractors mark their proposal questions read" on public.proposal_questions
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage attachments for their estimates" on public.estimate_attachments;
create policy "Users manage attachments for their estimates" on public.estimate_attachments
  for all using ((select auth.uid()) = user_id and exists (
    select 1 from public.estimates e
    where e.id::text = estimate_id and e.user_id = (select auth.uid())
  )) with check ((select auth.uid()) = user_id and exists (
    select 1 from public.estimates e
    where e.id::text = estimate_id and e.user_id = (select auth.uid())
  ));

create index if not exists estimate_attachments_user_id_idx on public.estimate_attachments(user_id);
create index if not exists estimate_email_events_user_id_idx on public.estimate_email_events(user_id);
create index if not exists estimates_user_id_idx on public.estimates(user_id);
create index if not exists line_items_estimate_id_idx on public.line_items(estimate_id);
create index if not exists tradeflow_admin_audit_actor_user_id_idx on public.tradeflow_admin_audit_log(actor_user_id);
create index if not exists tradeflow_admins_granted_by_idx on public.tradeflow_admins(granted_by);
create index if not exists tradeflow_support_notes_actor_user_id_idx on public.tradeflow_support_notes(actor_user_id);

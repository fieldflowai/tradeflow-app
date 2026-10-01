-- Keep browser access limited to signed-in users and the operations used by the app.
-- Row-level security remains the owner boundary; grants add the role-level boundary.

revoke all on table
  public.subscriptions,
  public.estimate_email_events,
  public.price_book_items,
  public.estimate_templates,
  public.jobs,
  public.proposal_questions,
  public.estimate_attachments,
  public.estimates,
  public.line_items
from anon, authenticated;

grant select on public.subscriptions to authenticated;
grant select, insert on public.estimate_email_events to authenticated;
grant select, insert, update, delete on
  public.price_book_items,
  public.estimate_templates,
  public.jobs,
  public.estimate_attachments,
  public.estimates,
  public.line_items
to authenticated;
grant select, update on public.proposal_questions to authenticated;

alter policy "Users can view their own subscription"
  on public.subscriptions to authenticated;
alter policy "Users view their estimate email events"
  on public.estimate_email_events to authenticated;
alter policy "Users record their estimate email events"
  on public.estimate_email_events to authenticated;
alter policy "Users manage their own price book"
  on public.price_book_items to authenticated;
alter policy "Users manage their own estimate templates"
  on public.estimate_templates to authenticated;
alter policy "Users manage their own jobs"
  on public.jobs to authenticated;
alter policy "Contractors read their proposal questions"
  on public.proposal_questions to authenticated;
alter policy "Contractors mark their proposal questions read"
  on public.proposal_questions to authenticated;
alter policy "Users manage attachments for their estimates"
  on public.estimate_attachments to authenticated;

-- The conversion RPC validates ownership itself and only serves the signed-in app.
revoke all on function public.convert_accepted_estimate_to_job(text, timestamptz, text, text)
  from public, anon;
grant execute on function public.convert_accepted_estimate_to_job(text, timestamptz, text, text)
  to authenticated, service_role;

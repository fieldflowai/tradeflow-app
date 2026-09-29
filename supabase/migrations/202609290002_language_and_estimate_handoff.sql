-- Bilingual proposals and a single, atomic approved-estimate-to-job conversion.
alter table public.estimates
  add column if not exists proposal_language text not null default 'en',
  add column if not exists converted_job_id text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'estimates_proposal_language_check'
  ) then
    alter table public.estimates add constraint estimates_proposal_language_check
      check (proposal_language in ('en', 'es'));
  end if;
end $$;

alter table public.line_items add column if not exists description_es text;

create or replace function public.convert_accepted_estimate_to_job(
  p_estimate_id text,
  p_scheduled_at timestamptz default null,
  p_title text default null,
  p_notes text default ''
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_estimate public.estimates%rowtype;
  v_user_id uuid := auth.uid();
  v_base numeric(12,2);
  v_total numeric(12,2);
  v_job_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to schedule this estimate.';
  end if;

  select * into v_estimate
  from public.estimates
  where id::text = p_estimate_id and user_id = v_user_id
  for update;

  if not found then raise exception 'Approved estimate not found.'; end if;
  if lower(v_estimate.status) <> 'accepted' then raise exception 'Only an approved estimate can be converted to a job.'; end if;
  if v_estimate.converted_job_id is not null then return v_estimate.converted_job_id::uuid; end if;
  if length(coalesce(p_title, '')) > 200 or length(coalesce(p_notes, '')) > 5000 then
    raise exception 'Job title or notes are too long.';
  end if;

  if v_estimate.selected_package is not null then
    select nullif(option->>'total', '')::numeric into v_base
    from jsonb_array_elements(coalesce(v_estimate.package_options, '[]'::jsonb)) as opt
    where opt->>'name' = v_estimate.selected_package
    limit 1;
    if v_base is null then raise exception 'The approved package total could not be found.'; end if;
    v_total := v_base * (1 + coalesce(v_estimate.tax_rate, 0) / 100);
  else
    select coalesce(sum(li.quantity * li.unit_price), 0) into v_base
    from public.line_items li
    where li.estimate_id::text = v_estimate.id::text;
    v_total := v_base * (1 + coalesce(v_estimate.markup_percentage, 0) / 100);
    v_total := v_total * (1 + coalesce(v_estimate.tax_rate, 0) / 100);
  end if;

  insert into public.jobs (
    user_id, estimate_id, title, client_name, client_email, job_address,
    scheduled_at, notes, quoted_total, status
  ) values (
    v_user_id, v_estimate.id::text,
    coalesce(nullif(trim(p_title), ''), coalesce(nullif(v_estimate.client_name, ''), 'Customer') || ' job'),
    v_estimate.client_name, v_estimate.client_email, coalesce(v_estimate.job_address, ''),
    p_scheduled_at, coalesce(p_notes, ''), round(v_total, 2), 'scheduled'
  ) returning id into v_job_id;

  update public.estimates set converted_job_id = v_job_id::text where id = v_estimate.id;
  return v_job_id;
end;
$$;

revoke all on function public.convert_accepted_estimate_to_job(text, timestamptz, text, text) from public;
grant execute on function public.convert_accepted_estimate_to_job(text, timestamptz, text, text) to authenticated;

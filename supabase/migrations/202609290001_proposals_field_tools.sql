-- Proposal branding, quote pricing snapshots, customer questions, and private job media.
alter table public.estimates
  add column if not exists tax_rate numeric(6,3) not null default 0 check (tax_rate between 0 and 100),
  add column if not exists markup_percentage numeric(6,2) not null default 0 check (markup_percentage between 0 and 500);

create table if not exists public.proposal_questions (
  id uuid primary key default gen_random_uuid(),
  estimate_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  customer_email text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists proposal_questions_user_created_idx
  on public.proposal_questions(user_id, created_at desc);
create index if not exists proposal_questions_estimate_email_created_idx
  on public.proposal_questions(estimate_id, customer_email, created_at desc);
alter table public.proposal_questions enable row level security;
drop policy if exists "Contractors read their proposal questions" on public.proposal_questions;
create policy "Contractors read their proposal questions" on public.proposal_questions
  for select using (auth.uid() = user_id);
drop policy if exists "Contractors mark their proposal questions read" on public.proposal_questions;
create policy "Contractors mark their proposal questions read" on public.proposal_questions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.estimate_attachments (
  id uuid primary key default gen_random_uuid(),
  estimate_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('photo', 'voice')),
  content_type text not null,
  created_at timestamptz not null default now()
);
create index if not exists estimate_attachments_estimate_idx on public.estimate_attachments(estimate_id);
alter table public.estimate_attachments enable row level security;
drop policy if exists "Users manage attachments for their estimates" on public.estimate_attachments;
create policy "Users manage attachments for their estimates" on public.estimate_attachments
  for all using (auth.uid() = user_id and exists (
    select 1 from public.estimates e where e.id::text = estimate_id and e.user_id = auth.uid()
  )) with check (auth.uid() = user_id and exists (
    select 1 from public.estimates e where e.id::text = estimate_id and e.user_id = auth.uid()
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('estimate-media', 'estimate-media', false, 15728640,
  array['image/jpeg','image/png','image/webp','image/heic','audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav'])
on conflict (id) do update set public = false, file_size_limit = 15728640;

drop policy if exists "Users upload their own estimate media" on storage.objects;
create policy "Users upload their own estimate media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'estimate-media' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "Users read their own estimate media" on storage.objects;
create policy "Users read their own estimate media" on storage.objects
  for select to authenticated using (
    bucket_id = 'estimate-media' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "Users delete their own estimate media" on storage.objects;
create policy "Users delete their own estimate media" on storage.objects
  for delete to authenticated using (
    bucket_id = 'estimate-media' and (storage.foldername(name))[1] = auth.uid()::text
  );

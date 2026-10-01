-- Reconstructed from the production schema metadata to make local resets reproducible.
-- The production tables already exist; IF NOT EXISTS lets the migration be recorded
-- there without replacing or modifying existing customer data.
create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  client_name text not null,
  client_email text not null,
  client_phone text,
  job_address text,
  require_deposit boolean default true,
  deposit_percentage numeric default 20,
  status text default 'pending',
  is_archived boolean default false,
  updated_at timestamptz default now()
);

create table if not exists public.line_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid references public.estimates(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0.00
);

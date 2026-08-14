-- File: supabase/migrations/0004_deposits_table.sql
-- Migration: Add deposits table for uninvested capital tracking
-- Created: 2026-08-14

-- Create deposits table
create table if not exists public.deposits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  date timestamptz not null default now(),
  account_type text not null check (account_type in ('ZAR', 'USD')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.deposits enable row level security;

-- RLS policies: users can only see/modify their own deposits
create policy "Users can view their own deposits"
  on public.deposits
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own deposits"
  on public.deposits
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own deposits"
  on public.deposits
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their own deposits"
  on public.deposits
  for delete
  using (auth.uid() = user_id);

-- Create index on user_id for faster queries
create index if not exists deposits_user_id_idx on public.deposits(user_id);

-- Create index on account_type for filtering
create index if not exists deposits_account_type_idx on public.deposits(account_type);

-- Create index on date for sorting
create index if not exists deposits_date_idx on public.deposits(date desc);

-- Add updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.deposits
  for each row
  execute function public.handle_updated_at();

-- File: supabase/migrations/0005_transaction_notes_tags.sql
-- Migration: Add notes and tags to transactions table
-- Created: 2026-08-14

-- Add notes field (text, nullable)
alter table public.transactions
add column if not exists notes text;

-- Add tags field (text array, nullable, default empty array)
alter table public.transactions
add column if not exists tags text[] default array[]::text[];

-- Create index on tags for efficient filtering
create index if not exists transactions_tags_idx on public.transactions using gin(tags);

-- Add comment for documentation
comment on column public.transactions.notes is 'Optional notes about the transaction (e.g., "Monthly contribution", "Rebalancing trade")';
comment on column public.transactions.tags is 'Optional tags for categorization (e.g., ["dividend reinvest", "rebalance"])';

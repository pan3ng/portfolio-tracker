-- Portfolio Tracker v1 schema
-- Mirrors portfolio-tracker-architecture.md §4.
-- RLS enabled on every table from migration #1, per Stack Playbook §1 checklist.

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  date timestamptz not null,
  shares numeric not null check (shares > 0),
  price_at_transaction numeric not null check (price_at_transaction > 0), -- ZAR, post ZAc conversion
  total_fees numeric not null default 0 check (total_fees >= 0),
  created_at timestamptz not null default now()
);

create table if not exists targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  target_weight_pct numeric not null check (target_weight_pct >= 0 and target_weight_pct <= 100),
  created_at timestamptz not null default now(),
  unique (user_id, ticker)
);

-- holdings is intentionally NOT a table in v1: it's derived at read time from
-- transactions + a live price fetch. Revisit only if computing it on every
-- request becomes a real perf problem (architecture doc: not expected at this scale).

create index if not exists idx_transactions_user_id on transactions(user_id);
create index if not exists idx_targets_user_id on targets(user_id);

alter table transactions enable row level security;
alter table targets enable row level security;

create policy "Users can manage their own transactions"
  on transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own targets"
  on targets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- File: supabase/migrations/0008_withdrawal_and_sell_types.sql
-- Migration: Add movement/transaction type discriminators for Withdrawal and Sell
--
-- Both tables previously modeled money moving in one direction only (deposits
-- always arrive, transactions are always buys). Adding a type column keeps
-- `amount`/`shares` always positive (the movement's magnitude) so every
-- existing sum/aggregate in the app keeps working unchanged — direction is
-- carried by the type column, never by a sign flip on the number itself.
-- Every existing row defaults to today's only real value, so no backfill
-- is needed.
--
-- Sell support (transaction_type = 'sell') is schema-ready here but not yet
-- enabled anywhere in the UI — that's Sub-phase B of this feature (realized
-- gains / cost-basis reduction in packages/api-client's calculatePortfolio()
-- needs to land first). Withdrawal (movement_type = 'withdrawal') is enabled
-- immediately in this same pass.

alter table public.deposits
  add column if not exists movement_type text not null default 'deposit' check (movement_type in ('deposit', 'withdrawal'));

alter table public.transactions
  add column if not exists transaction_type text not null default 'buy' check (transaction_type in ('buy', 'sell'));

comment on column public.deposits.movement_type is 'Direction of the cash movement: deposit (money in) or withdrawal (money out). amount is always positive; this column carries the sign.';
comment on column public.transactions.transaction_type is 'buy (shares acquired) or sell (shares disposed). shares is always positive; this column carries the sign. sell is schema-ready but not yet exposed in any UI.';

-- File: supabase/migrations/0006_deposit_method_fee.sql
-- Migration: Move deposit-method fee tracking from transactions to deposits
--
-- Deposit fees (card ~2%, EFT ~0%) are charged when money enters an account,
-- not when shares are bought from that money — a monthly deposit funds many
-- buys over time, so the fee doesn't belong to any single transaction.
-- transactions.deposit_method / deposit_fee stay in place (historical data,
-- still read by cost-basis/fee aggregates); going forward those columns will
-- just be 0/'card' defaults since new buy transactions no longer set them.

alter table public.deposits
  add column if not exists deposit_method text not null default 'card' check (deposit_method in ('card', 'eft')),
  add column if not exists deposit_fee numeric(12, 2) not null default 0 check (deposit_fee >= 0);

comment on column public.deposits.deposit_method is 'Method used to deposit funds: card (~2% fee) or eft (0% fee)';
comment on column public.deposits.deposit_fee is 'Fee charged by the deposit method on top of the deposited amount (informational — not deducted from amount)';

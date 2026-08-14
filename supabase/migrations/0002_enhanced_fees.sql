-- File: supabase/migrations/0002_enhanced_fees.sql
-- Add enhanced fee tracking and account support to transactions table

-- Add new fee breakdown columns to transactions
alter table transactions
  add column if not exists deposit_method text default 'card' check (deposit_method in ('card', 'eft')),
  add column if not exists commission_fee numeric default 0 check (commission_fee >= 0),
  add column if not exists deposit_fee numeric default 0 check (deposit_fee >= 0),
  add column if not exists fx_fee numeric default 0 check (fx_fee >= 0),
  add column if not exists other_fees numeric default 0 check (other_fees >= 0),
  add column if not exists account_type text default 'ZAR' check (account_type in ('ZAR', 'USD'));

-- Migrate existing total_fees to other_fees for backward compatibility
update transactions
set other_fees = total_fees
where other_fees = 0 and total_fees > 0;

-- For existing transactions, estimate commission_fee retroactively
-- Commission is typically 0.25% of (shares * price_at_transaction)
update transactions
set commission_fee = round((shares * price_at_transaction * 0.0025)::numeric, 2)
where commission_fee = 0;

-- For existing transactions, estimate deposit_fee retroactively (assuming card at 2%)
-- Deposit fee is typically 2% of investment amount for card
update transactions
set deposit_fee = round((shares * price_at_transaction * 0.02)::numeric, 2)
where deposit_fee = 0;

-- Add comment for documentation
comment on column transactions.deposit_method is 'Method used to deposit funds: card (1-2% fee) or eft (0% fee)';
comment on column transactions.commission_fee is 'Trading commission fee (typically 0.25% of investment)';
comment on column transactions.deposit_fee is 'Deposit method fee (card: ~2%, eft: 0%)';
comment on column transactions.fx_fee is 'Foreign exchange fee (typically 0.5% for cross-currency)';
comment on column transactions.other_fees is 'Other fees like donations, misc charges';
comment on column transactions.account_type is 'Account currency: ZAR or USD';
comment on column transactions.total_fees is 'DEPRECATED: Use sum of individual fee columns instead';

-- Add index for account_type filtering
create index if not exists idx_transactions_account_type on transactions(account_type);
create index if not exists idx_transactions_user_account on transactions(user_id, account_type);

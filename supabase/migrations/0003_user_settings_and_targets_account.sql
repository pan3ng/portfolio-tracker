-- File: supabase/migrations/0003_user_settings_and_targets_account.sql
-- Add user settings table and account_type to targets

-- Create user_settings table for user preferences
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_commission_pct numeric not null default 0.25 check (default_commission_pct >= 0 and default_commission_pct <= 100),
  default_card_deposit_pct numeric not null default 2.0 check (default_card_deposit_pct >= 0 and default_card_deposit_pct <= 100),
  default_eft_deposit_pct numeric not null default 0.0 check (default_eft_deposit_pct >= 0 and default_eft_deposit_pct <= 100),
  default_fx_pct numeric not null default 0.5 check (default_fx_pct >= 0 and default_fx_pct <= 100),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add account_type to targets table
alter table targets
  add column if not exists account_type text default 'ZAR' check (account_type in ('ZAR', 'USD'));

-- Update unique constraint to include account_type
-- Drop old constraint and create new one
alter table targets drop constraint if exists targets_user_id_ticker_key;
alter table targets add constraint targets_user_id_ticker_account_key unique (user_id, ticker, account_type);

-- Enable RLS on user_settings
alter table user_settings enable row level security;

-- Create RLS policy for user_settings
create policy "Users can manage their own settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Create index for user_settings (although it's a 1:1 relationship, good practice)
create index if not exists idx_user_settings_user_id on user_settings(user_id);

-- Add index for targets with account_type
create index if not exists idx_targets_user_account on targets(user_id, account_type);

-- Add trigger to automatically update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_user_settings_updated_at
  before update on user_settings
  for each row
  execute function update_updated_at_column();

-- Add comments for documentation
comment on table user_settings is 'User preferences including default fee percentages and theme';
comment on column user_settings.default_commission_pct is 'Default commission percentage (e.g., 0.25 for 0.25%)';
comment on column user_settings.default_card_deposit_pct is 'Default card deposit fee percentage (e.g., 2.0 for 2%)';
comment on column user_settings.default_eft_deposit_pct is 'Default EFT deposit fee percentage (typically 0%)';
comment on column user_settings.default_fx_pct is 'Default foreign exchange fee percentage (e.g., 0.5 for 0.5%)';
comment on column user_settings.theme is 'UI theme preference: light, dark, or system';
comment on column targets.account_type is 'Account currency for this target allocation: ZAR or USD';

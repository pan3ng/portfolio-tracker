-- File: supabase/migrations/0007_statutory_fee_columns.sql
-- Migration: Add JSE/regulator/SARS statutory fee columns to transactions
--
-- Mirrors EasyEquities' real fee breakdown for a JSE buy: alongside the existing
-- brokerage commission, four more statutory/regulatory line items apply. Rates are
-- hardcoded in FeeBreakdown.tsx for now (not user-configurable yet — see TODO.md
-- "Configurable statutory fee defaults").

alter table transactions
  add column if not exists settlement_admin_fee numeric default 0 check (settlement_admin_fee >= 0),
  add column if not exists ipl_admin_fee numeric default 0 check (ipl_admin_fee >= 0),
  add column if not exists securities_transfer_tax_fee numeric default 0 check (securities_transfer_tax_fee >= 0),
  add column if not exists vat_fee numeric default 0 check (vat_fee >= 0);

comment on column transactions.settlement_admin_fee is 'Electronic settlement + administration fee (flat ~0.075% of trade value)';
comment on column transactions.ipl_admin_fee is 'Investor protection levy + administration fee (~0.0002% of trade value)';
comment on column transactions.securities_transfer_tax_fee is 'SARS securities transfer tax (0.25% of trade value)';
comment on column transactions.vat_fee is 'VAT (15%) on brokerage-related fees (commission + settlement + IPL)';

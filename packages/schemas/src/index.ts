import { z } from "zod";

/**
 * Single source of truth for the v1 data model, shared by web + mobile.
 * Mirrors portfolio-tracker-architecture.md §4 "Schema (v1)".
 *
 * IMPORTANT: price_at_transaction is stored in ZAR (post-conversion).
 * The Yahoo Finance quote endpoint returns ZAc (cents) — the /100 conversion
 * happens once, inside the Edge Function price-fetch module, never here.
 * See architecture doc §3 "Critical implementation detail".
 */

export const TickerSchema = z
  .string()
  .min(1)
  .max(20)
  .regex(/^[A-Z0-9]+$/, "Ticker must be uppercase alphanumeric (JSE base symbol, no .JO suffix stored)");

export const TransactionSchema = z.object({
  id: z.string().uuid().optional(), // absent on insert, present on read
  user_id: z.string().uuid(),
  ticker: TickerSchema,
  date: z.string().datetime(),
  shares: z.number().positive(),
  price_at_transaction: z.number().positive(), // ZAR, already converted from ZAc
  total_fees: z.number().nonnegative(), // single lumped value for v1
  created_at: z.string().datetime().optional(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

// What the client sends when recording a new transaction — server fills id/user_id/created_at.
export const NewTransactionInputSchema = TransactionSchema.omit({
  id: true,
  user_id: true,
  created_at: true,
});
export type NewTransactionInput = z.infer<typeof NewTransactionInputSchema>;

export const TargetSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  ticker: TickerSchema,
  target_weight_pct: z.number().min(0).max(100),
});
export type Target = z.infer<typeof TargetSchema>;

// App-level validation: active targets must sum to 100% (see architecture doc §4).
export function validateTargetsSumTo100(targets: Pick<Target, "target_weight_pct">[]): {
  valid: boolean;
  sum: number;
} {
  const sum = targets.reduce((acc, t) => acc + t.target_weight_pct, 0);
  // allow small float tolerance
  return { valid: Math.abs(sum - 100) < 0.01, sum };
}

// Derived/materialized view — computed from transactions + latest fetched price, not a raw table.
export const HoldingSchema = z.object({
  ticker: TickerSchema,
  shares: z.number().nonnegative(),
  current_price: z.number().positive(), // ZAR
  current_value: z.number().nonnegative(), // shares * current_price
  current_weight_pct: z.number().min(0).max(100),
  target_weight_pct: z.number().min(0).max(100),
  drift_pct: z.number(), // current_weight_pct - target_weight_pct; negative = underweight
});
export type Holding = z.infer<typeof HoldingSchema>;

// Shape returned by the price-fetch Edge Function, already converted to ZAR.
export const QuoteSchema = z.object({
  ticker: TickerSchema,
  price_zar: z.number().positive(),
  fetched_at: z.string().datetime(),
});
export type Quote = z.infer<typeof QuoteSchema>;

# Portfolio Tracker

A personal JSE (Johannesburg Stock Exchange) portfolio tracker — manual transaction entry,
target-weight allocation planning, real fee breakdowns, and multi-account (ZAR/USD)
support. Single-user, deployed to production.

**Status: v1 shipped (2026-08-16), deployed to Vercel.** Ongoing work now happens on
feature branches off `main`, starting with `v1.1` — see `.claude/TODO.md` for the current
backlog and `.claude/portfolio-tracker-architecture.md` for full design history.

## What's in v1

- **Auth**: magic link (email OTP) and Google OAuth, via Supabase Auth
- **Overview**: portfolio value, gain/loss, fee totals, off-plan drift, cash ready to
  invest, allocation donut, rebalance suggestion
- **Holdings**: sortable table, per-holding detail page (cost basis, weight vs. target,
  transaction history)
- **Plan**: set target weights per ticker, validated to sum to 100%
- **Transactions**: add (real-time quote + full statutory fee breakdown matching
  EasyEquities' actual JSE buy costs — commission, settlement & admin, investor
  protection levy, VAT, securities transfer tax, each individually overridable), add
  historical (custom date/price), edit, delete
- **Deposits**: track cash into ZAR/USD accounts, with deposit-method fee tracking
  (card/EFT)
- **Settings**: default fee percentages, theme (light/dark/system), CSV import for
  bootstrapping historical holdings
- **Design system**: "Industry" — a blueprint/wireframe aesthetic (square corners,
  hairline borders, corner brackets, Barlow/Barlow Condensed type), built from the
  mockups in `design_handoff_portfolio_tracker/`

## Not in v1 (see TODO.md "Future Enhancements")

- A real native mobile app (`apps/mobile` is still an unmodified Expo scaffold — ground-up
  build scoped for v1.1+)
- Live FX rate fetching (USD transactions show the account's own currency symbol only, no
  real-time conversion)
- Real bid/ask pricing (share-count calculations use last-traded price, not a live quote
  feed — see the TODO entry for why and what a real fix requires)
- Sell/disposal and cash-withdrawal transaction types
- Interactive charts (value-over-time, drift-over-time are "coming soon" placeholders
  pending a price-history table)

## Stack

Turborepo monorepo:

- `apps/web` — Next.js (App Router), deployed to Vercel
- `apps/mobile` — Expo (React Native, TypeScript) — scaffold only, not yet built out
- `packages/schemas` — Zod schemas (`Transaction`, `Target`, `Holding`, `Quote`)
- `packages/api-client` — shared Supabase client factory, `fetchQuote()`, JSE ticker
  search/lookup, generated DB types
- `supabase/` — Postgres migrations, RLS policies, and the `get-quote` Edge Function
  (Yahoo Finance unofficial endpoint, JSE tickers — see architecture doc §3 for why)

## Running locally

```bash
npm install
```

`apps/web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`apps/mobile/.env` (once the mobile app is actually built out):

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Then, from `apps/web`:

```bash
npm run dev
```

Migrations live in `supabase/migrations/`. Apply new ones to the linked project with
`supabase db push` (see `.claude/TODO.md`'s gotchas section for a couple of CLI quirks
hit during v1 development).

## Documentation map

- **`.claude/TODO.md`** — the live, granular "what's next" list, including the full dated
  changelog of everything shipped in v1
- **`.claude/portfolio-tracker-architecture.md`** — design decisions and rationale (price
  data source, schema, auth method, deployment)
- **`.claude/Execution_Roadmap.md`** / **`.claude/Stack_Playbook.md`** — original
  phase-level planning docs from project kickoff
- **`design_handoff_portfolio_tracker/`** — the mockups and design tokens v1's visual
  design was built from

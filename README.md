# Portfolio Tracker

A personal JSE (Johannesburg Stock Exchange) portfolio tracker — manual transaction entry,
target-weight allocation planning, real fee breakdowns, and multi-account (ZAR/USD)
support, on both web and native mobile. Single-user, deployed to production.

**Status: v1.2.0 shipped (2026-08-16), deployed to Vercel + an EAS development build on
Android.** Ongoing work happens on the rolling `dev` branch, merged and tagged on `main`
when a batch is ready — see `.claude/TODO.md` for the current backlog and
`.claude/portfolio-tracker-architecture.md` for full design history.

## What's in v1.2

- **Auth**: magic link (email OTP) and Google OAuth, via Supabase Auth — web and mobile
- **Overview**: portfolio value, gain/loss, fee totals, off-plan drift, cash ready to
  invest, allocation breakdown, rebalance suggestion
- **Holdings**: sortable table (web) / dedicated tab (mobile), per-holding detail page
  (cost basis, weight vs. target, transaction history)
- **Plan**: set target weights per ticker, validated to sum to 100%, with a "Set target →"
  prompt on any holding that doesn't have one yet
- **Transactions**: add (real-time quote + full statutory fee breakdown matching
  EasyEquities' actual JSE buy costs — commission, settlement & admin, investor
  protection levy, VAT, securities transfer tax, each individually overridable), add
  historical (custom date/price, web only), edit, delete — full CRUD on both platforms
- **Deposits**: track cash into ZAR/USD accounts, with deposit-method fee tracking
  (card/EFT) — full CRUD on both platforms
- **Settings**: default fee percentages (web), theme (light/dark/system, both platforms),
  CSV import for bootstrapping historical holdings (web), Clear My Data / Delete My
  Account
- **Design system**: "Industry" — a blueprint/wireframe aesthetic (square corners,
  hairline borders, corner brackets, Barlow/Barlow Condensed type), shared across web and
  mobile, built from the mockups in `design_handoff_portfolio_tracker/`

### Mobile (`apps/mobile`)

Native Expo/React Native app, sharing business logic with web via `packages/api-client`
(portfolio math, fee calculation, ticker search all live in one place, not duplicated
per-platform). 5-tab navigation (Overview, Holdings, **+** add-action sheet, Activity,
More), with Plan and Settings reachable from More. Activity merges transactions and
deposits into one chronological, searchable feed. Runs as an EAS development build, not
Expo Go — see the TODO.md entry on why Expo Go doesn't work reliably for this app's
sign-in flow.

## Not in v1.2 (see TODO.md "Future Enhancements")

- **Sell/disposal and cash-withdrawal transaction types** — the schema and every screen
  only model buys/deposits (positive-only positions). This is the single biggest
  functional gap and the prerequisite for the planned unified Buy/Sell/Deposit/Withdrawal
  "Activity ledger" redesign.
- Live FX rate fetching (USD transactions show the account's own currency symbol only, no
  real-time conversion)
- Real bid/ask pricing (share-count calculations use last-traded price, not a live quote
  feed — see the TODO entry for why and what a real fix requires)
- Interactive charts (value-over-time, drift-over-time are "coming soon" placeholders
  pending a price-history table)
- Mobile: native date picker (dates are plain text fields for now), CSV import, editable
  fee defaults, the "Money" settings section (rate source/FX spread) — all deliberately
  left out rather than half-built; see TODO.md's Mobile Milestone entries for the
  reasoning on each
- CI/CD for EAS builds — deferred as premature at current build volume/quota; see TODO.md

## Stack

Turborepo monorepo:

- `apps/web` — Next.js (App Router), deployed to Vercel
- `apps/mobile` — Expo (React Native, TypeScript), EAS development build
- `packages/schemas` — Zod schemas (`Transaction`, `Target`, `Holding`, `Quote`)
- `packages/api-client` — shared Supabase client factory, `fetchQuote()`, portfolio
  calculation (`calculatePortfolio`), statutory fee calculation
  (`calculateStatutoryFees`), JSE ticker search/lookup, generated DB types — the one place
  business logic lives so web and mobile can't silently drift apart
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

`apps/mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Web, from `apps/web`:

```bash
npm run dev
```

Mobile, from `apps/mobile` (requires an installed EAS development build on the device —
Expo Go will not work correctly for sign-in, see TODO.md):

```bash
npx expo start
```

Migrations live in `supabase/migrations/`. Apply new ones to the linked project with
`supabase db push` (see `.claude/TODO.md`'s gotchas section for a couple of CLI quirks
hit during v1 development).

## Documentation map

- **`.claude/TODO.md`** — the live, granular "what's next" list, including the full dated
  changelog of everything shipped, including every mobile milestone
- **`.claude/portfolio-tracker-architecture.md`** — design decisions and rationale (price
  data source, schema, auth method, deployment, branching convention)
- **`.claude/Execution_Roadmap.md`** / **`.claude/Stack_Playbook.md`** — original
  phase-level planning docs from project kickoff
- **`design_handoff_portfolio_tracker/`** — the original web mockups and design tokens v1
  was built from; the mobile redesign (Milestone 4) was imported separately from a Claude
  Design project via the `claude_design` MCP

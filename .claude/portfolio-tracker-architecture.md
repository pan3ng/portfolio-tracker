# Portfolio Tracker — Solution Architecture

**Status:** Finalized design, v1 scope
**Author context:** Solo dev, React/Next/Supabase/Vercel/Git familiarity, building with Claude Code
**Date:** August 2026

---

## 1. Problem Restatement

Tracking a monthly ETF investment portfolio (currently via EasyEquities, JSE-listed ETFs such as STX40) is done manually today in a spreadsheet — capturing purchases, fees, and prices by hand, then manually computing portfolio weighting to decide where the next ~R1000 contribution should go. The goal is a cross-platform app (Android first, iOS later) that automates price fetching and weighting calculations, removes manual data entry, and is broker-agnostic — it tracks *your* decisions and positions, independent of which platform (EasyEquities or otherwise) the trade was actually made on.

---

## 2. Assumptions & Constraints

**Functional requirements**
- Transaction-by-transaction entry: user specifies an amount to invest in a ticker; app fetches current price, calculates shares, records the transaction
- View total portfolio value, per-holding value, and current allocation % vs target weighting
- Under/overweight signal per holding to guide the next contribution
- Editable target weights per holding (simple field-level editing for v1, with sum-to-100% validation)
- One-time CSV import as a bootstrap tool for seeding historical holdings (not a recurring dependency)
- (Deferred, nice-to-have) predictions/analysis/nudges — explicitly out of v1 scope

**Non-functional requirements**
- Scale: single user, low tens of holdings, monthly transaction cadence — nothing here needs to be built for throughput
- Latency: on-demand quote fetch at transaction time and at portfolio view; delayed/EOD-ish pricing is acceptable, true real-time streaming is not required
- Availability: no formal SLA — personal tool, not a trading system
- Security: handles financial data; no brokerage credentials are stored in v1 (see below)
- Team: solo dev, Claude Code, existing familiarity with React/Next/Supabase/Vercel/Git
- Budget: near-zero for v1 (free tiers)

**Explicit decisions made during design**
- **Single user for v1**, but public multi-user is a real later goal — Supabase Auth + Row Level Security (RLS) and `user_id`-scoped tables are used from day one even with one user, since retrofitting this later is expensive
- **Broker-agnostic by construction**: the app does not integrate with EasyEquities. It fetches independent market prices and records what the user tells it they did. This removes brokerage-credential custody and ToS risk from the architecture entirely.
- **Fees lumped as a single value per transaction for v1** — schema allows a later breakdown (fee type table) without touching historical rows
- **No FSCA licensing exposure in v1** — the app calculates and displays the user's own numbers; it does not give advice to other people or execute trades. This changes the moment the app becomes multi-user and/or offers guidance to others.

---

## 3. Price Data Source — Validated

**Decision: Yahoo Finance's unofficial chart/quote endpoint, using `.JO`-suffixed JSE tickers (e.g. `STX40.JO`).**

### Why this over alternatives

| Provider | Cost | JSE coverage | Verdict |
|---|---|---|---|
| **Yahoo Finance (unofficial, `.JO`)** | Free | Confirmed live for Satrix ETF family | **Chosen for v1** |
| Twelve Data | JSE requires paid "Pro" tier | Full | Fallback if a contracted/supported feed is needed later |
| Financial Modeling Prep | Free tier is EOD/fundamentals-focused | Unverified for JSE | Untested alternative |
| Community JSE hobby APIs | Free | Unverified, several appear unmaintained/defunct | Avoided — no reliability track record |

### Validation performed

A test script queried `https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}.JO` for four real holdings. Result:

```
STX40.JO:   price=10647 ZAc | prevClose=10770 | exchange=JNB
STXNDQ.JO:  price=27350 ZAc | prevClose=27278 | exchange=JNB
STXWDM.JO:  price=11945 ZAc | prevClose=11923 | exchange=JNB
STX500.JO:  price=13434 ZAc | prevClose=13364 | exchange=JNB
```

All four resolved correctly, exchange confirmed as JNB, timestamps current, no rate-limiting or auth blocking encountered.

### Critical implementation detail

**Prices are returned in ZAc (cents), not ZAR.** `10647` means R106.47. Every price-fetch call must divide by 100 before any downstream calculation (shares bought, position value, weighting). Comment this conversion explicitly in code — it's an easy thing to silently get wrong.

### Accepted risk

This is an **unofficial** endpoint with no formal SLA or contract — it could change or start rate-limiting without notice. Accepted for v1 given the coverage confirmed above and zero cost. Mitigation: isolate the price-fetch call behind a single module/interface in the Edge Function layer, so swapping to Twelve Data or another paid vendor later is a contained change, not a rearchitecture.

---

## 4. Recommended Architecture

**Stack:** Supabase (Postgres + Auth + Edge Functions) as backend, React Native (Expo) as the cross-platform client, Android first.

This matches existing tool familiarity, requires near-zero ops for a solo dev, and avoids over-engineering — no message queue, no microservices, no scheduled batch pipeline are justified at this scale.

### Schema (v1)

- **`transactions`**: `user_id`, `ticker`, `date`, `shares`, `price_at_transaction` (ZAR, post-conversion), `total_fees` (single lumped value)
- **`holdings`** (derived/materialized): current shares and value per ticker, computed from `transactions` + latest fetched price
- **`targets`**: `user_id`, `ticker`, `target_weight_pct` — editable rows, app-level validation that active targets sum to 100%

All tables scoped by `user_id` with RLS enabled from day one, even though v1 has exactly one user.

---

## 5. Risks & Tradeoffs

**What could break this**
- Yahoo's unofficial endpoint changes format or starts blocking — mitigated by isolating the fetch behind one swappable module
- CSV bootstrap format changes if EasyEquities updates their export — low risk since it's a one-time-use path, not a recurring dependency
- Silent ZAc/ZAR conversion bugs — mitigated by an explicit, commented conversion step and (recommended) a unit test on the price-fetch function

**Debt/lock-in accepted**
- Supabase lock-in — acceptable at solo-dev scale; Postgres underneath keeps migration possible later
- Dependence on an unofficial, uncontracted price feed — acceptable given zero cost and confirmed coverage; explicitly flagged for revisit, not a silent risk

**What would trigger a revisit**
- If the app opens to other users: revisit auth model beyond current RLS scoping, and reassess whether any feature crosses into giving advice to others (FSCA licensing territory)
- If Yahoo's endpoint becomes unreliable: swap to Twelve Data (Pro tier) via the isolated price-fetch module
- If "global" expansion becomes real: revisit currency handling, multi-jurisdiction compliance, and tax-year logic

---

## 6. Implementation Notes

**Suggested phasing**
1. Schema + manual transaction entry (ticker, amount, fetched price, fee) + weighting calculation + allocation view
2. One-time CSV bootstrap import for seeding historical holdings
3. Refinements: fee breakdown by type, guided rebalancing suggestions (both explicitly deferred from v1)

**Still open**
- Exact UI for the fee-entry step during transaction confirmation
- Whether unallocated/cash balance is tracked explicitly or treated as an implicit remainder against 100% target weight

---

## 7. Build Log / Decisions Since Design

Chronological record of what's actually been done, for continuity across Claude Code sessions.

- **Repo scaffolded**: Turborepo monorepo — `apps/web` (Next.js/App Router), `apps/mobile` (Expo TS), `packages/schemas` (Zod: Transaction/Target/Holding/Quote), `packages/api-client` (Supabase client factory + `fetchQuote()`)
- **`supabase/migrations/0001_init.sql`** written and applied — `transactions` + `targets` tables, RLS enabled from migration #1
- **`supabase/functions/get-quote`** written — isolated Yahoo Finance price-fetch module, ZAc→ZAR conversion happens in exactly one place, per §3 mitigation above
- **GitHub repo created**, local git initialized, pushed to `main` (nested `.git` inside `apps/mobile` from `create-expo-app` was removed before first commit — watch for this if the mobile app is ever re-scaffolded)
- **`devEngines` strict pin removed** from root `package.json` (was blocking `npm install` on newer npm versions); **`packageManager: "npm@10.9.7"`** field added back afterward — Turborepo requires this field (or `devEngines.packageManager`) to resolve the workspace, build failed on Vercel without it
- **Supabase project created**, linked via `supabase link`, migration applied via `supabase db push`
- **`supabase/.temp/`** (CLI-generated local link state) added to `.gitignore` — not meant to be version controlled
- **`apps/mobile/.gitignore`** had a gap — only ignored `.env*.local`, not plain `.env`; added `.env` explicitly before first commit
- **Vercel connected** to `apps/web` via GitHub import, root directory set to `apps/web`, env vars added for Production + Preview (same Supabase project for both — no separate staging project yet)
- **Env var naming**: using `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase's newer "publishable key" terminology), not the older `ANON_KEY` naming — kept consistent across `apps/web/.env.local`, `apps/mobile/.env`, and Vercel's env var settings
- **Auth method decided: magic link** (Supabase Auth, email OTP), not OAuth — rationale: single-user personal app, avoids provider app-registration overhead; OAuth remains easy to add later if the app ever goes multi-user
- **Magic link enabled** in Supabase dashboard; redirect URLs configured for `localhost:3000` (local) + Vercel production URL (+ optionally `https://*.vercel.app` for previews)
- **Phase 1 gate confirmed**: `apps/web` runs locally and on Vercel, `apps/mobile` bundles cleanly and connects via Expo Go QR code on a physical device, no env var errors in either

**Not yet done (see TODO.md for the live list):**
- `@supabase/supabase-js` + `@supabase/ssr` not yet added to `apps/web`
- No `/login` page yet
- No auth-protecting middleware yet
- No transaction-entry or allocation-view UI yet

---

**v1 shipped (2026-08-16).** Everything between the Phase 1 gate above and v1 — full
transaction/deposit/fee/allocation UI, the "Industry" blueprint design system, multi-account
support — happened across many sessions and is tracked as dated `## <feature> (<date>,
COMPLETED ✅)` entries in `TODO.md`'s "Previously Completed" section rather than
backfilled here; that file is the authoritative changelog going forward.

One addition worth recording here since it revises a decision above: **Google OAuth was
added alongside magic link** (§ decision above said "not OAuth... remains easy to add
later if the app ever goes multi-user" — turned out to be wanted for convenience even as
a single-user app, not because of a multi-user need). Configured via a Google Cloud OAuth
client (Web application type, authorized redirect URI set to Supabase's
`https://<project-ref>.supabase.co/auth/v1/callback`, *not* the app's own `/auth/callback`
— that's Supabase's callback, which then forwards to ours) and enabled as a provider in
Supabase's dashboard. No app code changes needed beyond a `signInWithOAuth` call and a
button on `/login` — the existing `/auth/callback` route already handled the PKCE code
exchange generically (magic link and OAuth both land there the same way).

Process from this point: `main` tracks what's deployed to production. Versions live only
as git tags on `main` (`v1.0.0`, then `v1.1.0`, etc.) — never as branch names, since a
branch named after a version turned out to be an easy way to lose track of not being on
`main`. New work happens on one rolling branch, `dev`, and merges back to `main` (then
gets tagged) when a batch is ready to ship. A short-lived `feature/<name>` branch off
`dev` is available for anything large/risky enough to want isolated review first, but
isn't the default.

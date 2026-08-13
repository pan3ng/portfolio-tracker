# Execution Roadmap — Portfolio Tracker

Filled in from `portfolio-tracker-architecture.md`, `Stack_Playbook.md`, and actual
build progress. See `TODO.md` for the live, granular next-actions list — this file
tracks phase-level status.

---

## 0. MVP DEFINITION

- **One-sentence problem / user this app serves**
  Solo investor (me) manually tracks a monthly JSE ETF portfolio in a spreadsheet;
  this app automates price fetching and weighting math so I can see, per contribution,
  which ETF is underweight and how much to buy — independent of which broker the trade
  actually happens on.

- **Success metric(s) — how you'll know it's working**
  - I can record a real monthly contribution end-to-end (ticker → fetched price →
    shares → fee → saved) without touching the spreadsheet
  - The allocation view correctly flags the most underweight holding, matching a
    manual calculation
  - Zero ZAc/ZAR conversion bugs across at least one full month of real use

- **Feature list, split:**
  - **Must exist for MVP1**
    - Auth (magic link) — DECIDED, in progress
    - Transaction entry: ticker + amount → fetched price → shares → fee → save
    - Portfolio view: total value, per-holding value, current % vs target %
    - Under/overweight signal per holding
    - Editable target weights (sum-to-100% validated)
  - **Explicitly deferred (and why)**
    - One-time CSV bootstrap import — needed to seed history, but not needed to
      validate the core loop; do after the core flow works with fresh data
    - Fee breakdown by type — schema allows it later, no reason to build now
    - Predictions/analysis/nudges — out of v1 scope per architecture doc
    - iOS — Android first per Stack Playbook phase sequence

  - **What "MVP1" is NOT trying to prove yet**
    Multi-user support, scale/throughput, formal uptime, brokerage integration,
    monetization, iOS.

---

## 1. PHASE LEDGER

| Phase | Scope (1 line) | Intake form used | Key risks accepted | Revisit trigger | Status |
|---|---|---|---|---|---|
| MVP1 | Web MVP: auth, core schema, transaction entry, allocation view | Standard | Unofficial Yahoo Finance endpoint; Supabase/Expo lock-in; single-user RLS scoping | Yahoo endpoint breaks/rate-limits → swap to Twelve Data via isolated module; app opens to other users → revisit auth + FSCA exposure | **In progress — Phase 1 (repo init) done, Phase 2 (auth) in progress** |
| MVP2 | Android build of same core flow (Expo) | Stress-test | Emulator-only testing gaps vs real devices | Native module need that Expo can't support | Not started |
| MVP3 | CSV bootstrap import + fee breakdown by type | Stress-test | CSV format drift if EasyEquities changes export (low risk, one-time path) | EasyEquities export format changes | Not started |
| Prod-readiness | iOS build, then full stress-test pass | Stress-test (production lens) | — | — | Not started |
| GA | — | — | — | — | Not started |

---

## 2. PER-PHASE CHECKLIST

### Phase: MVP1

**a. Scope cut**
- In: Supabase Auth (magic link), `transactions` + `targets` tables with RLS,
  `get-quote` Edge Function, web transaction-entry flow, allocation view with
  under/overweight signal
- Out: CSV import, fee breakdown, Android/iOS builds, anything multi-user

**b. Architecture pass**
- [x] Intake form filled (standard) — see `portfolio-tracker-architecture.md`
- [x] Recommended approach agreed — Supabase + Expo + Next.js, documented
- [x] Revisit triggers from prior phase checked — n/a, first phase

**c. Build**
- [x] Repo scaffolded: Turborepo, `apps/web`, `apps/mobile`, `packages/schemas`,
      `packages/api-client`
- [x] `supabase/migrations/0001_init.sql` written and applied — `transactions` +
      `targets`, RLS enabled from migration #1
- [x] `supabase/functions/get-quote` written — isolated price-fetch module, ZAc→ZAR
      conversion in exactly one place
- [x] Root `npm install` run clean, workspaces linked
- [x] GitHub repo created, pushed, Vercel connected (root dir `apps/web`)
- [x] Supabase project created (dev env), linked via `supabase link`
- [x] `0001_init.sql` applied to that project
- [x] `.env.local` (web) / `.env` (mobile) populated
- [x] Decide-before-building: **Auth method → magic link, decided**
- [x] Phase 1 gate confirmed: web local + Vercel + mobile Expo Go all load cleanly
- [ ] `supabase gen types typescript` wired into a script
- [ ] Magic link enabled + redirect URLs configured in Supabase — DONE (dashboard)
- [ ] `@supabase/supabase-js` + `@supabase/ssr` added to `apps/web`
- [ ] `/login` page built (`signInWithOtp`)
- [ ] Auth-protecting middleware added
- [ ] Milestones above turned into tickets

**d. Validate**
- What you're measuring against the MVP definition's success metric:
  a real transaction recorded end-to-end, and the allocation view's underweight
  signal checked against a manual calculation
- What you actually learned (fill in after): —

**e. Gate decision**
- [ ] Design held → proceed to MVP2 (Android), stress-test only
- [ ] Requirements changed shape → MVP2 gets a standard intake pass
- [ ] Stop/pivot → why

---

## 3. CROSS-CUTTING TRACKS

**Tech decisions log**
- Supabase over Firebase — relational data (holdings/transactions), RLS as auth
  boundary (Stack Playbook default)
- Expo over bare RN — shared codebase, faster ship, accepted ceiling on native access
  (Stack Playbook default)
- Turborepo monorepo — shared types/schemas across web + mobile from day one
  (Stack Playbook default)
- Yahoo Finance unofficial `.JO` endpoint over paid providers — free, confirmed live
  for the 4 real holdings tested; isolated behind `get-quote` so it's swappable
  (architecture doc §3)
- `holdings` is NOT a stored table in v1 — derived at read time from `transactions` +
  live price; revisit only if this becomes a real perf problem
- Auth: magic link over OAuth — single user, avoids provider app-registration
  overhead, OAuth easy to add later (see architecture doc §7)
- Env var naming: `*_SUPABASE_PUBLISHABLE_KEY` (Supabase's current terminology),
  not the older `*_ANON_KEY` naming
- Root `package.json` needs a `packageManager` field (or `devEngines.packageManager`)
  for Turborepo to resolve the workspace — learned the hard way via a Vercel build
  failure; don't remove this field again

**Debt & lock-in register** (carried from architecture doc §5 + Stack Playbook §4)
- Supabase lock-in: Postgres portable, Auth/Storage/Edge Functions are not —
  migration cost grows with Edge Function usage specifically
- Expo lock-in: low until a native module forces eject to bare workflow — watch
  explicitly, don't let it surprise mid-build
- Dependence on unofficial, uncontracted Yahoo Finance endpoint — zero cost,
  confirmed coverage, explicitly flagged for revisit, not silent
- RLS complexity: easy to under-scope early, fails visibly only under multi-tenant
  load — revisit trigger is the first feature involving shared/team data
- Single Supabase project used for both Production and Preview Vercel environments
  — acceptable at solo scale, revisit if a staging project is ever warranted

**Non-functional creep**
- None yet — still single-user, low-tens-of-holdings, monthly cadence as originally
  scoped. Watch this if the app ever opens to other users (auth model + FSCA exposure
  both need a revisit per architecture doc §5).

---

## 4. PRODUCTION READINESS PASS
*(Run once, before GA — not started, MVP1 not yet built)*

- [ ] Security review
- [ ] Compliance sign-off (n/a unless multi-user — see FSCA note in architecture doc)
- [ ] Observability / monitoring in place
- [ ] Backup & disaster recovery tested
- [ ] Load tested against real projected volume
- [ ] Rollback plan documented

---

## 5. POST-LAUNCH CADENCE

- **Open revisit triggers currently being watched:**
  - Yahoo Finance endpoint changes format or starts rate-limiting
  - App opens to users beyond me (auth model + FSCA licensing exposure)
  - "Global"/multi-currency expansion becomes real
  - A native module Expo can't support becomes a hard requirement
  - Preview/Production Vercel environments ever need separate Supabase projects

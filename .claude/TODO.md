# TODO — Portfolio Tracker

Live, granular next-actions list. Phase-level status lives in `Execution_Roadmap.md`;
full design context lives in `portfolio-tracker-architecture.md`; stack conventions
live in `Stack_Playbook.md`. This file is the "what do I do right now" list.

**If you're Claude Code picking this up fresh**: read `portfolio-tracker-architecture.md`
§7 (Build Log) first for full context on what's already been decided and built, then
come back here for the immediate next steps.

---

## Immediate next actions (Phase 2 — Auth)

- [x] Add `@supabase/supabase-js` and `@supabase/ssr` to `apps/web`
- [x] Create the Supabase client setup in `apps/web` following the SSR pattern for
      Next.js App Router (separate client for Server Components vs. browser client) —
      use `packages/api-client`'s existing `createSupabaseClient()` factory as the base,
      don't duplicate client creation logic
      - Created `lib/supabase/server.ts` for Server Components
      - Created `lib/supabase/client.ts` for Client Components
      - Created `lib/supabase/middleware.ts` for middleware
- [x] Build `/login` page: email input, calls `supabase.auth.signInWithOtp({ email })`,
      shows a "check your inbox" confirmation state
      - Created `app/login/page.tsx` with email input and magic link request
      - Created `app/auth/callback/route.ts` to handle magic link redirects
- [x] Add `middleware.ts` to protect routes — redirect unauthenticated requests to
      `/login`
      - Created `middleware.ts` at root with auth checking and redirect logic
- [ ] Test the full magic link flow locally: request link → click email link → land
      authenticated on a protected route
- [ ] Confirm it also works on the Vercel preview/production URL (redirect URLs are
      already configured in Supabase for this — see architecture doc §7)

## After auth works — Phase 2 continued (core flow)

- [ ] Build transaction-entry form: ticker input → call `get-quote` Edge Function via
      `fetchQuote()` from `packages/api-client` → show price + calculated shares →
      fee input → confirm → insert into `transactions` table
- [ ] Build allocation/portfolio view: derive current holdings from `transactions` +
      live prices (NOT a stored table — see architecture doc §4), compute current
      weight % per ticker, compare against `targets`, show under/overweight signal
- [ ] Build target-weight editing UI — simple field-level editing, validate sum = 100%
      using `validateTargetsSumTo100()` already written in `packages/schemas`
- [ ] `supabase gen types typescript` — wire into a package.json script, regenerate
      after the migration (types don't currently exist as generated code, only as
      hand-written Zod schemas in `packages/schemas`)

## Known open questions (from architecture doc §6, still unresolved)

- [ ] Exact UI for the fee-entry step during transaction confirmation
- [ ] Whether unallocated/cash balance is tracked explicitly or treated as an implicit
      remainder against 100% target weight

## Deferred (explicitly out of MVP1 — don't build yet)

- One-time CSV bootstrap import
- Fee breakdown by type
- Predictions/analysis/nudges
- Android build (Phase 3), iOS build (Phase 4)
- Multi-user support of any kind

## Gotchas already hit once — don't repeat

- Root `package.json` MUST have a `packageManager` field (currently `"npm@10.9.7"`) —
  removing it breaks Turborepo's workspace resolution and fails Vercel builds
- `apps/mobile/.gitignore` must explicitly include `.env` (not just `.env*.local`)
- If `apps/mobile` is ever re-scaffolded, check for and remove a nested `.git` folder
  before committing at the monorepo root
- `expo start` pressing `a` (Android emulator) or `w` (web) will error out — neither is
  set up and neither is needed; test via the QR code + Expo Go on a physical device only
- Env var names use `PUBLISHABLE_KEY`, not `ANON_KEY` — stay consistent with this
  across `apps/web/.env.local`, `apps/mobile/.env`, and Vercel's dashboard

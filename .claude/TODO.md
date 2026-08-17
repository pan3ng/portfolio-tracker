# TODO — Portfolio Tracker

Live, granular next-actions list. Phase-level status lives in `Execution_Roadmap.md`;
full design context lives in `portfolio-tracker-architecture.md`; stack conventions
live in `Stack_Playbook.md`. This file is the "what do I do right now" list.

**If you're Claude Code picking this up fresh**: read `portfolio-tracker-architecture.md`
§7 (Build Log) first for full context on what's already been decided and built, then
come back here for the immediate next steps.

---

## ✅ V1 SHIPPED (2026-08-16)

`main` is deployed to production on Vercel as v1. It includes: magic-link + Google OAuth
sign-in, the full "Industry" blueprint design system, Overview/Holdings/Holding
detail/Plan/Transactions/Settings/Deposits pages, sortable tables, real JSE statutory fee
breakdown on buys (commission, settlement & admin, IPL, VAT, securities transfer tax),
deposit-level fee tracking, and multi-account (ZAR/USD) support. Full dated changelog for
everything that shipped is in the "Previously Completed" section further down this file
(each entry is a `## <feature> (<date>, COMPLETED ✅)` header) — that's the real history;
this file was not rewritten to consolidate it.

**Process going forward**: per the earlier v1 roadmap decision, changes now happen on a
branch rather than directly on `main` — `main` tracks what's actually deployed to
production. **Versions live only as git tags on `main`, never as branch names** (decided
2026-08-16, after `v1.1`-as-a-branch-name turned out to be confusing to work in day to
day). The rolling work branch is called `dev` — all v1.1+ work happens there. When a
coherent batch is ready to ship: merge `dev` → `main`, push (triggers the Vercel
production deploy), then tag the release (`git tag -a v1.1.0 -m "..."`, following on
from `v1.0.0`). `dev` keeps going for the next batch. A short-lived `feature/<name>`
branch off `dev` is the escape hatch for anything large/risky enough to want isolated
review before landing on `dev` — not the default, just available if needed.

**The "🎯 Recommended Next Steps" list immediately below is stale/historical** — written
early in the project and superseded by everything that's actually shipped since (several
of its items, like transaction notes/tags, are long done). The **real** current backlog
for v1.1+ is the "Future Enhancements" section further down: configurable statutory fee
rates, live FX rate fetching, a real bid/ask price feed, the weight-impact preview on the
buy screen, and the bigger unified "Add Transaction" + Activity ledger screen (which
itself depends on building Sell and Withdrawal first). A real native Expo mobile app is
also now in scope for v1.1+, scoped out in a prior conversation — not yet logged in detail
here.

---

## 🎯 Recommended Next Steps (Prioritized) — historical, superseded (see note above)

Based on current state and user feedback, tackle in this order:

### Quick Wins (1-2 hours each)
1. **Transaction notes/tags** - Add optional notes and tags for categorization
2. **Fee breakdown tooltip** - Hover to see fee details in portfolio table
3. **Empty states** - Better onboarding hints for new users

### Medium Effort (Half day each)
4. **Dashboard improvements** - Quick stats cards, better visual hierarchy
5. **Mobile responsiveness** - Optimize tables, touch-friendly controls
6. **Export to CSV** - Download transactions and portfolio data
7. **About page** - Mission statement, features, privacy stance

### Larger Features (1-2 days each)
8. **Portfolio performance charts** - Historical value, P/L trends
9. **Rebalancing calculator** - Suggest exact trades to hit targets
10. **Dividend tracking** - Track and display dividend income

**Total estimated time for items 1-7:** ~2-3 days of focused work

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
- [x] Test the full magic link flow locally: request link → click email link → land
      authenticated on a protected route ✅ VERIFIED WORKING
- [x] Confirm it also works on the Vercel preview/production URL (redirect URLs are
      already configured in Supabase for this — see architecture doc §7) ✅ VERIFIED WORKING

## After auth works — Phase 2 continued (core flow)

- [x] Build transaction-entry form: ticker input → call `get-quote` Edge Function via
      `fetchQuote()` from `packages/api-client` → show price + calculated shares →
      fee input → confirm → insert into `transactions` table
      - Created `/transactions/new` page with full transaction entry flow
      - Integrated with `get-quote` Edge Function for live price fetching
      - Automatic share calculation based on amount invested
      - Saves to `transactions` table via Supabase client
      - Updated home page to show recent transactions and link to add new ones
      - Added sign-out functionality
- [x] Build allocation/portfolio view: derive current holdings from `transactions` +
      live prices (NOT a stored table — see architecture doc §4), compute current
      weight % per ticker, compare against `targets`, show under/overweight signal
      - Created `/portfolio` page with live holdings calculation
      - Fetches current prices for all tickers in parallel
      - Displays current vs target weights with drift signals
      - Color-coded rebalancing indicators (underweight/balanced/overweight)
      - Added navigation links from home page
- [x] Build target-weight editing UI — simple field-level editing, validate sum = 100%
      using `validateTargetsSumTo100()` already written in `packages/schemas`
      - Created `/targets` page with full CRUD for target allocations
      - Real-time sum=100% validation with color-coded feedback
      - Add/remove target rows dynamically
      - Integrated ticker search/autocomplete
- [x] Add smart ticker search/autocomplete feature
      - Created comprehensive JSE ticker database (45+ ETFs and stocks)
      - Built reusable TickerSearch component with keyboard navigation
      - Integrated into all forms (transactions/new, edit, targets)
      - Searches by symbol, name, provider, or category
- [x] `supabase gen types typescript` — wire into a package.json script, regenerate
      after the migration (types don't currently exist as generated code, only as
      hand-written Zod schemas in `packages/schemas`)
      - Generated database.types.ts from remote Supabase schema
      - Added `npm run gen:types` script to package.json
      - Exported Database type from api-client package
      - Provides full TypeScript type safety for all database operations

## Known open questions (from architecture doc §6, still unresolved)

- [ ] Exact UI for the fee-entry step during transaction confirmation
- [ ] Whether unallocated/cash balance is tracked explicitly or treated as an implicit
      remainder against 100% target weight

## Current Work — Enhanced Fees & Multi-Account Support

### Phase 1: Database & Settings (COMPLETED ✅)
- [x] Create database migration for enhanced fee tracking (deposit_method, commission_fee, deposit_fee, fx_fee, other_fees, account_type)
- [x] Create user_settings table migration (default fee percentages, theme preferences)
- [x] Add account_type to targets table with updated unique constraint
- [x] Apply migrations to Supabase remote database
- [x] Regenerate TypeScript types from updated schema
- [x] Create Settings page UI (/app/settings/page.tsx)
      - Default fee percentages (commission, card deposit, EFT deposit, FX)
      - Theme selector (Light/Dark/System)
      - Future features placeholders

### Phase 2: Transaction Forms with Fee Breakdown (COMPLETED ✅)
- [x] Update transaction entry form (/app/transactions/new/page.tsx)
      - Added account selector (ZAR/USD) at top
      - Added deposit method selector (Card/EFT)
      - Loads user's default fee percentages from settings
      - Auto-calculates fee breakdown in real-time
      - Displays expandable "Fee Details" section with editable overrides
      - Added "Other Fees" field for donations/misc
      - Shows total cost: Investment Amount + All Fees
      - Updates form submission to save all fee fields
- [x] Update transaction edit form (/app/transactions/[id]/edit/page.tsx)
      - Added same fee breakdown UI as entry form
      - Pre-populates with existing fee values
      - Handles account_type and deposit_method display/editing
- [x] Create reusable FeeBreakdown component (apps/web/components/FeeBreakdown.tsx)
      - Shared between new/edit transaction forms
      - Accepts: investmentAmount, depositMethod, accountType, userSettings
      - Returns: calculated fees with override capabilities
      - Includes manual override tracking and reset functionality

### Phase 3: Fix Cost Basis & Portfolio Calculations (COMPLETED ✅)
- [x] Update portfolio page cost basis calculation
      - Cost basis now includes all fees: (shares × price_at_transaction) + all fees
      - Separated "Share Value" from "Fees" for transparency
      - Added "Market P/L" (share value movement only) vs "Total P/L" (after fees)
      - Profit/loss accurately reflects total money spent
      - Implemented in both /app/page.tsx and /app/portfolio/page.tsx
- [ ] **RECOMMENDATION**: Add fee breakdown tooltip in portfolio table
      - Show fee details on hover over purchase value (not yet implemented)
      - Helps user understand what fees went into each position

### Phase 4: Landing Page Restructure (COMPLETED ✅)
- [x] Restructured /app/page.tsx as new portfolio landing page
      - Portfolio view is now the main landing page at /
      - /app/portfolio/page.tsx remains as alternative view (legacy)
      - /app/dashboard/page.tsx created for future use
- [x] Add account filter tabs to portfolio landing (All/ZAR/USD)
      - Filter holdings by selected account
      - Show account column when "All" selected
      - Responsive design with mobile dropdown
- [x] Add "Recent Transactions" section below holdings table
      - Shows last 10 transactions (filtered by account if selected)
      - Condensed view: Date, Ticker, Shares, Amount, Fees, Account
      - "View All Transactions" link → /transactions
- [x] Create dedicated transactions page (/app/transactions/page.tsx)
      - Full transaction history
      - Filters: Account, Ticker (date range not yet implemented)
      - Expandable rows to show fee breakdown (commission, deposit, FX, other)
      - Edit actions per row
- [x] Add navigation links to Settings page in main nav
      - Added to header with Targets, Add Transaction, etc.

### Phase 5: Account-Specific Features (COMPLETED ✅)
- [x] Update targets page to support account-specific allocations
      - Added account selector tabs (ZAR/USD)
      - Validates sum=100% per account independently
      - Allows different target allocations for ZAR vs USD
      - Saves and loads account-specific targets correctly
- [x] Account balance summary card
      - Portfolio summary shows totals broken down by selected account filter
      - Displays: Share Investment, Fees, Total Cost, Current Value, Market P/L, Total Return
      - Color-coded profit/loss indicators

## Future Enhancements (Post Current Phase)

### CI/CD workflow for EAS builds (2026-08-16, recommendation: not yet, premature)

Asked about explicitly; logging the recommendation and shape for later rather than
building it now.

**Not necessary at this stage** — reasoning:

- Solo dev, single manual trigger point today: the mobile app has exactly one build ever
  triggered (`eas build` run manually from the CLI). Manual triggering isn't a bottleneck
  yet — CI/CD earns its keep by removing real friction, and there isn't any to remove.
- **The 10-builds/month free EAS tier quota is the binding constraint, not manual
  effort.** A workflow firing on every push to `dev` would burn a month's entire quota in
  days. Making it useful would need deliberately narrow triggers (tag push or manual
  `workflow_dispatch` only) — which mostly reproduces what running `eas build` by hand
  already gives, for real infrastructure cost to set up and maintain.
- Mobile is still Milestone 1 of many (1 of ~10 planned screens built), and the build
  this quota concern is about hadn't even confirmed yet, at time of writing, whether it
  fixes the sign-in issue it exists to test. Investing in release automation before the
  thing being released is stable is backwards ordering.
- **Revisit when**: mobile reaches enough feature parity for a real release cadence
  (regular builds for testers), a second contributor joins, or app-store submission
  (`eas submit`) becomes a recurring rather than one-off action. None of those are true
  today.

**Shape for whenever this is picked up:**

- GitHub Actions workflow, triggered narrowly — a version tag push or manual
  `workflow_dispatch`, never on every commit, given the quota above.
- Needs an EAS robot access token (`EXPO_TOKEN`) stored as a GitHub Actions secret —
  `eas login`'s interactive browser flow (used manually, see the Mobile Milestone 1 entry
  above) doesn't work in CI.
- Ties into the still-open question of when `preview`/`production` EAS profiles get added
  (only `development` exists in `eas.json` today, from Milestone 1's setup) — CI would
  likely target `preview` for internal testers first; `production` + `eas submit` only
  once real store distribution is actually planned, not before.
- Should run `tsc`/lint as a gate before triggering any build — reuse the same
  verification commands (`npx tsc --noEmit -p apps/mobile`) already used manually
  throughout this project, don't invent a new check.

### Onboarding for new users (2026-08-16, future — not designed)

Some guided first-run experience for a brand-new account with no data yet — e.g.
prompting a first deposit and a first target once the empty-state ("Welcome to Portfolio
Tracker... Get started by recording your first transaction") is showing. Explicitly not
designed in the v1.1 pass that added the landing page/Danger Zone/tooltips — flagged for
later.

### Live FX rate fetching for USD transactions (recommendation, not started)

Right now USD-account transactions store `amount` in dollars but `price_at_transaction`
is always the ZAR share price (`quote.price_zar`) — there's no exchange rate anywhere,
so a USD investor can't see what a purchase actually cost in dollar terms or reconcile
against their brokerage statement. Recommended approach when this gets picked up:

- **New Edge Function** `get-fx-rate`, mirroring the existing `get-quote` function's shape
  (same auth/CORS pattern, same "fetch → cache → return" structure) rather than a new
  architectural pattern
- **Rate source**: a free-tier FX API with a USD/ZAR pair and no key requirement for low
  volume (e.g. exchangerate.host or Frankfurter) — daily rates are precise enough for this
  use case; a paid real-time feed is overkill for a personal portfolio tracker
- **Caching**: same idea as quote caching — store the day's rate (e.g. a small
  `fx_rates(date, pair, rate)` table or a cache column) and reuse it for the rest of the
  day rather than calling out on every page load; FX rates don't move enough intraday to
  matter for this app's purposes
- **UI hook-in**: call it once when `accountType === 'USD'` is selected and a quote has
  been fetched, then show a small "≈ R{amount × rate}" hint next to the amount field —
  informational only, doesn't change any stored value or calculation
- **Scope boundary**: this is about *displaying* an equivalent ZAR value for context, not
  changing how `price_at_transaction`/`shares`/fees are computed — those stay exactly as
  they are today (quote price is always ZAR, amount is always the account's own currency)
  to avoid a much bigger rework of the fee/cost-basis math for comparatively little value

### Real bid/ask ("buy at ask") pricing instead of last-trade price (2026-08-15, recommendation, not started)

Flagged by a real discrepancy: for a live example (R2000 + fees, ticker last-traded at
R106.60), this app calculated 18.71 shares while EasyEquities' actual market-order fill
came to 18.26 shares — because EE executes at the live **ask** price (R109.50 in that
example), not the last-traded price. Our only quote source, `supabase/functions/get-quote`,
reads Yahoo Finance's unofficial `regularMarketPrice` (last trade) and has no bid/ask data
at all — this is a known, documented tradeoff (architecture doc §3), not a bug.

- **Spread behavior** (general market microstructure, not JSE-specific data we have):
  the bid-ask spread is not constant — it moves continuously through the trading day,
  typically widening at open/close and during volatile moves, tightening mid-session.
  It also varies a lot *between* tickers: liquid, heavily-traded instruments (like the
  large Satrix ETFs this app is built around) tend to have tight spreads; thinly-traded
  tickers can have much wider ones. Both are standard market-structure facts, not
  something inferred from this app's data.
- **Why we shouldn't approximate it with a guessed flat %**: our current price source
  carries zero spread information, so any hardcoded "add X%" adjustment would be a
  fabricated number presented as if it were real JSE data — worse than being upfront
  about the estimate. Not implemented for this reason.
- **Real fix**: a licensed real-time Level 1 quote feed with actual bid/ask (e.g. Twelve
  Data's paid Pro tier, already flagged as the fallback vendor in the architecture doc if
  Yahoo's unofficial endpoint ever becomes unreliable) — the same class of change as the
  FX-rate item above: a new, isolated Edge Function following the existing `get-quote`
  pattern, not a rearchitecture.
- **Cheap interim mitigation** (worth doing regardless of the above): add a small note on
  the Add Transaction page that the calculated share count is an *estimate* based on the
  last traded price, not a guaranteed fill — the historical form's manual-price override
  already covers the case where the user knows their actual fill price after the fact.

### Native Expo mobile app — Milestone 1 (Foundation + Sign-in + Overview) (2026-08-16, COMPLETED ✅)

`apps/mobile` was the untouched `create-expo-app` scaffold before this — `App.tsx`/`index.ts`
deleted, replaced with a real `expo-router`-based app. A PWA-wrapping-the-web-app alternative
was considered (much less work) but explicitly rejected in favor of a real native app.

- **Routing**: switched to `expo-router` (file-based, `app/` directory) rather than manually
  wiring `@react-navigation/native` — it's the SDK's own first-party, actively-documented
  navigation solution, needs far less manual boilerplate, and matches the mental model
  already used in `apps/web`'s App Router. `app.json` updated: `scheme: "portfoliotracker"`,
  `plugins: ["expo-router"]` (`expo-status-bar`/`expo-web-browser` plugins auto-added by
  `expo install`), `experiments.typedRoutes`. `package.json` `main` → `"expo-router/entry"`.
- **Supabase client** (`lib/supabase.ts`): `@supabase/supabase-js` with `AsyncStorage`-backed
  session persistence (`react-native-url-polyfill` imported first, per Supabase's own RN
  guide) — reads `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from
  `apps/mobile/.env` (already populated with real values from repo init).
- **Auth** (`app/sign-in.tsx`, `lib/auth.ts`, deep-link handling in `app/_layout.tsx`):
  magic link + Google OAuth, mirroring `/login`'s content. **Important mechanism
  difference from web, confirmed against Supabase's current docs**: mobile does *not* use
  `exchangeCodeForSession(code)` the way `apps/web/app/auth/callback/route.ts` does — there's
  no server route to land on. Instead the redirect lands as a deep link carrying
  `access_token`/`refresh_token` directly in the URL, exchanged via `supabase.auth.setSession()`
  (see `lib/auth.ts#createSessionFromUrl`). OAuth uses `expo-auth-session`'s
  `makeRedirectUri()` together with `expo-web-browser`'s `openAuthSessionAsync()` to open
  the consent flow and catch the return. **Dashboard step needed before this works**:
  Supabase's Redirect URLs allow-list
  needs the mobile scheme added — `portfoliotracker://**` for a standalone/dev-client build,
  and (for testing via Expo Go, per the existing physical-device-only gotcha below) whatever
  `exp://` proxy URL Expo Go's dev session uses; not yet added, not yet tested end-to-end on
  a device. The Google Cloud OAuth client itself needs **no** changes — its authorized
  redirect URI is Supabase's own callback, identical for web and mobile.
- **Shared calc logic**: `app/index.tsx` (Overview) imports `calculatePortfolio`/
  `getActiveTickers`/`fetchQuote` from `@portfolio-tracker/api-client` — the same functions
  `apps/web/app/(app)/page.tsx` now uses (extracted from web in this same pass, see the
  commit "Extract portfolio calc logic to packages/api-client"). No calculation logic
  duplicated between platforms.
- **Verification performed**: `tsc --noEmit` clean, `npx expo-doctor` 20/21 checks passed,
  `npx expo export --platform android` compiled the full production bundle (1326 modules)
  with no resolution/syntax errors. **Tested on an actual device (2026-08-16) and
  confirmed working** — both magic-link and Google OAuth sign-in succeed end-to-end on an
  EAS development build (see "Mobile: move off Expo Go onto a development build" below for
  why Expo Go itself couldn't get past sign-in, and how that was root-caused and fixed).
- **Known gotcha**: `expo-doctor`'s one failing check is a duplicate `react` version —
  `apps/mobile` needs its own exact `react@19.2.3` (confirmed correct per `expo install
  --check`), while the workspace root hoists `react@19.2.8` for `apps/web`'s looser
  `^19.2.0` range. Not fixed (mobile's own `node_modules/react` copy takes precedence
  within `apps/mobile`, and touching `apps/web`'s pinned version wasn't worth the risk to a
  deployed app for a warning that mainly matters for native builds, not Expo Go testing) —
  revisit if `eas build`/`expo run:android` ever hits real duplicate-module errors.
- **Not built in this milestone** (unchanged from before): Holdings list, Holding detail,
  Plan/Targets, Transactions, Settings, Deposits screens; the full "Industry" design-system
  port (this milestone's screens are functional but plainly styled, not blueprint-matched);
  charts (donut, weight bars) — same "coming soon" treatment web already has, once mobile
  gets there.

### Native Expo mobile app — Milestone 2 (Transactions, Targets, Settings, Deposits, Holding detail — read views) (2026-08-16, COMPLETED ✅)

Built out the rest of the screens listed as missing from Milestone 1, scoped deliberately to
**viewing**, not editing — add/edit forms for transactions, deposits, and targets stay a
future milestone. Reasoning: Milestone 1 proved sign-in and the shared calc engine both
work; the fastest way to make the app actually useful day-to-day is full read coverage of
what's already in the database, before taking on the added complexity (and duplicate-fee-math
risk) of native input forms.

- **Navigation restructure**: added an `(tabs)` route group (`expo-router`'s `Tabs`) with
  four tabs — Overview, Transactions, Targets, Settings — replacing the single-screen stack
  from Milestone 1. `app/index.tsx` moved to `app/(tabs)/index.tsx`; `app/_layout.tsx`'s
  auth-redirect logic needed no changes since group segments like `(tabs)` don't affect the
  `segments[0] === 'sign-in'` check.
- **Transactions tab**: read-only list (`app/(tabs)/transactions.tsx`), account filter
  (All/ZAR/USD), tap-to-expand fee breakdown per row — mirrors the web transactions table's
  columns without the edit affordance.
- **Targets tab**: view-only current-vs-target weight per holding with a drift indicator
  (`app/(tabs)/targets.tsx`), reusing `calculatePortfolio()`'s existing `target_weight_pct`/
  `drift_pct` fields — no separate calculation logic needed. Editing targets stays web-only
  for now.
- **Settings tab**: sign-out moved here from the Overview header; ported the full Danger
  Zone (Clear My Data / Delete My Account with type-to-confirm) from the web settings page,
  same Supabase calls. Fee-default editing and the light/dark theme picker were left out —
  mobile doesn't have per-transaction fee override UI yet, so defaults have nothing to feed.
- **Deposits screen** (`app/deposits.tsx`, pushed from Settings, not a tab): view-only list
  with account filter and a total. Add/edit deposit form not built.
- **Holding detail** (`app/holding/[ticker].tsx`, pushed by tapping a row on Overview):
  per-ticker P&L, cost basis, and fee totals computed by calling `calculatePortfolio()` with
  just that ticker's transactions — reuses the exact same fee math as everywhere else in the
  app rather than re-deriving it, at the cost of the weight/drift fields being meaningless
  on this screen (single-ticker input makes weight trivially 100%) and so left off it.
- **No new native dependencies** — no icon library added (tab bar is text-label only, to
  avoid an EAS rebuild for this pass); every new screen is plain JS/RN core, so the existing
  installed EAS development build picked all of it up over Metro with a plain reload, no
  new `eas build` spent.
- **Verification performed**: `tsc --noEmit` clean, `npx expo-doctor` 20/21 (same
  pre-existing duplicate-`react` warning as Milestone 1, not touched by this pass),
  `npx expo export --platform android` compiled clean (1333 modules, up from 1326).
- **Not built in this milestone**: add/edit forms for transactions, deposits, and targets;
  the "Industry" blueprint design-system port (screens remain plainly styled); charts
  (donut, weight bars) on Targets/Overview — same "coming soon" as web already has.

### Native Expo mobile app — Milestone 3 (Add Transaction, Add Deposit, Edit Targets forms) (2026-08-16, COMPLETED ✅)

Closed the gap Milestone 2 deliberately left open: every screen now has a way to create/edit
the thing it displays, not just view it.

- **`packages/api-client/src/fee-calc.ts`** (new): extracted the statutory fee formulas
  (settlement & admin, IPL, VAT, securities transfer tax, commission, FX) out of web's
  `FeeBreakdown` component into a shared `calculateStatutoryFees()` function, so mobile's
  Add Transaction form computes the exact same numbers instead of re-deriving the rates by
  hand. Web's `FeeBreakdown.tsx` was left as-is (its manual-override/edit-rates state is
  tightly coupled to the component and already shipped) — only mobile consumes the new
  shared function for now.
- **`app/transactions/new.tsx`**: Buy-only form matching web's current scope (Sell is still
  "coming soon" everywhere). Currency toggle, ticker input with a live autocomplete dropdown
  (`searchJSETickers`, already bundled in `api-client`, so no new ticker data or network call
  needed), Get Quote, amount, an auto-calculated read-only fee breakdown, total-to-pay
  summary, notes, and a comma-separated tags field (plain text, not the chip-style `TagInput`
  web uses — cheaper to build, same end data shape).
- **`app/deposits/new.tsx`**: amount, account, deposit method (card/EFT), fee
  auto-calculated from the user's saved `default_card_deposit_pct`/`default_eft_deposit_pct`
  (editable to override), description. Required moving `app/deposits.tsx` to
  `app/deposits/index.tsx` so `deposits/new` could nest under it (a file route and a
  directory route of the same name can't coexist in expo-router, same constraint as Next.js).
- **`app/targets/edit.tsx`**: full list editor (add/remove ticker rows, live sum-to-100%
  validation via the already-shared `validateTargetsSumTo100`) using the same
  delete-all-then-insert-all save pattern as web's targets page. Reachable via a new "Edit
  Targets" button on the Targets tab.
- **No native date picker** — deposit date and (implicitly) transaction date stay plain
  text/auto-today rather than adding `@react-native-community/datetimepicker`, which would
  require a native module and therefore a new EAS build. Revisit once another change needs
  a rebuild anyway, and batch it in then rather than spending a build on this alone.
- **Verification performed**: `tsc --noEmit` clean, `npx expo export --platform android`
  compiled clean (1337 modules, up from 1333). No new native dependencies, so the existing
  installed EAS development build picks this up over a Metro reload — restarted Metro fresh
  after adding the new route files to make sure expo-router's route manifest picked up
  `transactions/new`, `deposits/new`, and `targets/edit`.
- **Not built**: Sell/Withdrawal transactions (blocked on the same web-side prerequisite as
  the web transactions redesign); editing/deleting existing transactions or deposits from
  mobile (add-only for now — edits still need the web app); the chip-style tag input; a
  native date picker.

### Native Expo mobile app — Milestone 4 ("Industry" design-system port + navigation restructure) (2026-08-16, COMPLETED ✅)

Imported the mobile mockups from the Claude Design project (`Canvas.dc.html`, project
`158b2b26-52b9-48ee-8cba-138d0468542a`) via the `claude_design` MCP and applied them —
closing the "functional but plainly styled" gap called out since Milestone 1. This was a
full visual + navigation rebuild, not incremental styling.

- **Design tokens** (`lib/theme.ts`): light/dark palettes transcribed by hand from the
  design system's `styles.css` custom properties (RN has no CSS custom properties) —
  `--color-bg`/`-surface`/`-text`/`-accent`/`-divider` and the accent/neutral tonal ramps.
  `lib/ThemeContext.tsx` (new) provides `useTheme()`, mirrors web's light/dark/system
  preference (persisted to AsyncStorage, synced to `user_settings.theme` same as web).
- **Fonts**: added `expo-font`, `@expo-google-fonts/barlow`, `@expo-google-fonts/barlow-condensed`
  (Barlow for body text, Barlow Condensed for headings, matching the design system's Google
  Fonts import exactly). `expo-font`'s native module was already compiled into the current
  EAS dev build — it's a direct dependency of the `expo` package itself, not something we
  added — so loading custom fonts via `useFonts()` in `app/_layout.tsx` needed no new native
  build, just a Metro reload. `app.json`'s `userInterfaceStyle` changed `light` → `automatic`;
  **this one native-config field needs a future rebuild to fully take effect on Android** —
  until then, explicit Light/Dark selection in Settings works regardless, but "Device" may
  not correctly track the OS theme on this specific installed binary.
- **Shared primitives** (`components/`): `BlueprintCard` (hairline border + 4 corner
  registration ticks, built from plain `View`s — `::before`/`::after` don't exist in RN),
  `Button`, `Segmented`, `Tag`, `WeightBar` (fill bar + target tick mark, used on
  Holdings/Holding-detail/Plan), `Corner`. `TabIcon.tsx` — the bottom-tab icons (dashboard
  grid, list, document, menu) are built from plain bordered `View`s, not SVGs:
  `react-native-svg` isn't installed and has a native module, so adding it would have forced
  an EAS rebuild just for icons.
- **Navigation restructured** to match the mockup's IA: 5-tab bar (Overview, Holdings,
  center **+** action, Activity, More) replacing Milestone 2/3's 4 tabs
  (Overview/Transactions/Targets/Settings). The **+** tab never navigates — its
  `tabBarButton` is overridden to intercept the press and open `AddActionSheet`, a bottom
  modal offering Buy / Sell (disabled, "coming soon") / Deposit. **More** is a real
  full-screen tab (Plan, Deposits & cash, Import CSV [not built, shown disabled], Settings,
  sign out) rather than a true sliding bottom sheet like the mockup shows — simpler and more
  robust in expo-router than intercepting tab presses to render an overlay, at the cost of
  one visual simplification.
- **Overview** (`(tabs)/index.tsx`) rebuilt as a dashboard: hero value, gain/return cards,
  an off-plan/cash-ready/best-worst stat row, an allocation breakdown, and a "what to do
  next" suggestion card. Two things worth flagging since they're new logic, not just
  restyling:
  - **"Off your plan by X pts"** = half the sum of `|drift_pct|` across targeted holdings
    (standard rebalancing-distance metric — equals both the total overweight and total
    underweight amounts when targets sum to 100%).
  - **"What to do next"** picks the 1–2 most-underweight holdings and suggests splitting
    uninvested cash across them proportionally to their drift gap. Only shown when there's
    both uninvested cash and an underweight holding — never fabricated. This is a genuinely
    new feature (a simple rebalancing suggestion), not just a mockup port.
  - The mockup's allocation **donut chart** is rendered as a horizontal stacked bar + legend
    instead — real per-ticker weight data (not a placeholder), just without
    `react-native-svg` to draw an actual circle.
- **Holdings** (`(tabs)/holdings.tsx`, new tab): dedicated list with weight bars, target
  tick marks, and Overweight/Underweight tags — split out of what used to be Overview's
  inline holdings list.
- **Holding detail, Record transaction**: restyled in place to match the mockup (blueprint
  metric cards, fee-breakdown card, weight-vs-target bar), logic unchanged from Milestone
  2/3.
- **Activity** (renamed from Transactions): now interleaves deposits into the same
  chronological feed as transactions (mockup shows deposits inline — Milestone 2/3's
  Transactions tab queried only the `transactions` table), grouped by month, with a ticker/tag
  search field. Tap-to-expand fee breakdown kept from Milestone 2.
- **Plan** (`app/plan.tsx`, new — reachable from More): merges what were two separate
  screens (Milestone 2's view-only Targets tab and Milestone 3's `targets/edit.tsx`) into
  one, matching the mockup: editable target-weight inputs sit directly above each holding's
  live current-weight bar, so drift is visible while editing instead of in a separate view.
  `(tabs)/targets.tsx` and `targets/edit.tsx` were deleted.
- **Settings** (`app/settings.tsx`, moved off the tab bar to a pushed route reachable from
  More): restyled with the mockup's Appearance section, now actually wired to
  `useTheme().setPreference()` (functional, not decorative). The mockup's "Money" section
  (rate source, FX spread, "show amounts in") and CSV export/import were **deliberately
  left out** rather than built as inert-looking controls — nothing backs them yet, and
  fake-functional UI is worse than an honest gap. The working Danger Zone (Clear My
  Data / Delete My Account, type-to-confirm) was restyled to match but **not reduced** to
  the mockup's single ghost-link "Delete account" — the real confirm flow was kept because
  it's tested, working safety-critical functionality per this project's standing rule about
  not reverting working functionality for a mockup's sake.
- **Sign-in** restyled for token/font consistency; no functional change.
- **Verification performed**: `tsc --noEmit` clean, `npx expo-doctor` 20/21 (same
  pre-existing duplicate-`react` warning, untouched by this pass), `npx expo export
  --platform android` compiled clean (1390 modules, up from 1337). Metro restarted fresh
  after the route restructure (screens renamed/deleted/added) so expo-router's manifest
  picked up the new tree; the already-installed EAS dev build picks up all of this over a
  plain reload — no new native dependencies were added (fonts' native module was already
  present, icons are plain Views, no SVG library).
- **Known simplifications vs. the mockup** (all noted above, consolidated here): More is a
  full screen, not a sliding sheet; allocation is a stacked bar, not a donut; tab icons are
  View-based, not the mockup's stroke SVGs (same visual shapes, built differently); "Device"
  theme detection needs a future native rebuild to fully track Android's OS theme.

### Native Expo mobile app — Milestone 5 (Edit Transaction, fee-rate editing, Set target) (2026-08-16, COMPLETED ✅)

Closed three gaps spotted in review right after Milestone 4 shipped: no way to edit an
existing transaction, no way to override an individual fee on Add Transaction (web has
had "Edit rates" since the 3e mockup pass), and no prompt to set a target for a holding
that doesn't have one yet.

- **`components/FeeBreakdownCard.tsx`** (new): mobile's counterpart to web's
  `FeeBreakdown.tsx` — auto-calculates the full statutory fee stack via the already-shared
  `calculateStatutoryFees()`, but now with an "Edit rates" toggle that swaps each read-only
  fee line for an editable input, tracks which fields were manually overridden (so
  recalculating on amount/account changes doesn't clobber an edit), and a "Reset to
  calculated values" action once adjusted — mirrors web's `manualOverrides` behavior
  field-for-field. Replaces the static read-only fee list `transactions/new.tsx` had in
  Milestone 4; both `transactions/new.tsx` and the new edit screen share it now.
- **`app/transactions/[id]/edit.tsx`** (new): mirrors web's `/transactions/[id]/edit` —
  loads the existing row (pre-filling `FeeBreakdownCard` with its stored, possibly-already-
  overridden fee values via `initialFees`), lets the ticker/account/amount/fees/notes/tags
  all be changed, "Get Quote" re-fetches a fresh price if wanted (otherwise keeps the
  stored one), and adds a working Delete button (Cancel/Delete/Save, matching web's
  3-button footer). Date is not editable, same as web — the update payload never touches
  it.
- **Activity screen**: the fee-breakdown-expanded row now has an "Edit transaction" link
  (this was already in the design mockup's screen 1f — missed wiring it up in Milestone 4)
  that navigates to the new edit screen.
- **"Set target" prompts** added everywhere a holding can lack one, matching web's existing
  `hasTarget` pattern from `/portfolio`: Holdings tab rows and the Holding detail screen
  both show "Set target →" instead of a weight bar when `target_weight_pct` is 0, linking
  to `/plan?ticker=X&account=Y`. `app/plan.tsx` now reads those query params and — mirroring
  web's targets page exactly — queues a fresh zero-weight row for that ticker (only if it
  isn't already targeted) and switches the account segment to match, so the user only has
  to type the percentage.
- **Bug fix, found while wiring up "Set target" on Holding detail**: that screen was
  computing `current_weight_pct`/`drift_pct` by calling `calculatePortfolio()` with only
  the one ticker's transactions, which makes portfolio value equal that single holding's
  value — so "Weight vs target" always showed "now 100.0%" regardless of the holding's
  actual share of the portfolio. Fixed by fetching all transactions (not ticker-filtered)
  and all active tickers' prices, running the full calculation, then picking the one
  holding out of `result.holdings` — same data Holdings/Overview already compute, just
  filtered down for display. The per-ticker transaction list shown on the page is still
  filtered client-side from the same fetch, so no extra query.
- **Verification performed**: `tsc --noEmit` clean, `npx expo export --platform android`
  compiled clean. No new native dependencies. Metro restarted fresh so expo-router picked
  up the new `transactions/[id]/edit` dynamic route.
- **Not built**: editing/deleting deposits or targets from mobile (still add/edit-in-place
  only for transactions; deposits and targets remain add-only or full-replace-on-save from
  mobile, same as before this pass).

### Native Expo mobile app — Milestone 6 (Edit/Delete Deposit — mobile parity close-out) (2026-08-16, COMPLETED ✅)

Closed the last mobile-vs-web parity gap flagged after Milestone 5: deposits were add-only
on mobile. (Targets/Plan turned out to already be at parity — `app/plan.tsx`'s per-row ✕ +
save pattern mirrors web's targets page exactly, both being a full-replace-on-save editor
rather than per-row PATCH; no work needed there.)

- **`app/deposits/[id]/edit.tsx`** (new): mirrors web's deposits page edit-in-place form —
  amount, date, account, method, fee (prefilled from the stored value rather than
  auto-recalculated, same as web's `handleEdit`, since a saved deposit's fee may already
  have been manually overridden), description, and a working Delete. Cancel/Delete/Save
  footer, same 3-button shape as the transaction edit screen from Milestone 5.
- **Deposits list** (`app/deposits/index.tsx`): rows are now tappable, navigating to the
  new edit screen — previously view-only.
- **Verification performed**: `tsc --noEmit` clean, `npx expo export --platform android`
  compiled clean. No new native dependencies. Metro restarted fresh so expo-router picked
  up the new `deposits/[id]/edit` dynamic route.
- **Mobile is now at full CRUD parity with web** for transactions and deposits (add, edit,
  delete both); targets/plan parity confirmed pre-existing. Remaining mobile gaps are all
  bigger, separately-scoped items: Sell/Withdrawal (blocked on the same web-side
  prerequisite as the unified Activity ledger redesign), the "Industry" design system's
  aspirational Settings sections (Money/CSV — deliberately not built, see Milestone 4), and
  a native date picker (deferred to batch with some other native-dependency change).

### Mobile: move off Expo Go onto a development build (2026-08-16, COMPLETED ✅ — root cause confirmed)

Discovered while trying to test Milestone 1 on a physical Android device: scanning the QR
code failed with "project is incompatible with this version of Expo Go," and the Play
Store had no update available. Root cause (confirmed against Expo's own May 2026
changelog, not a project misconfiguration): Expo changed Expo Go distribution — the
app-store build is no longer guaranteed to track new SDK releases, and this project is on
SDK 57. Worked around for now with a sideloaded SDK-57 Expo Go APK
(`expo.dev/go?device=true&platform=android&sdkVersion=57`), but that's a stopgap — the
real fix, and the thing to do before going much further on mobile, is switching to a
**development build** (the app compiled as its own binary, with `expo-dev-client` for the
same hot-reload/dev-tools Expo Go gives, but not dependent on Expo's separately-versioned
shared client). This also fixes the *other* problem hit at the same time: OAuth/magic-link
redirects currently need Supabase's Redirect URLs to contain a network-dependent
`exp://<LAN-IP>:8081` entry that breaks every time the dev machine's IP changes — a
development build uses the stable `portfoliotracker://` custom scheme instead, registered
once, permanently.

**What it takes, when this gets picked up:**

- `npx expo install expo-dev-client`; `npm install -g eas-cli`; `eas login` (free Expo
  account); `eas init` (adds a `projectId` to `app.json`); `eas build:configure`
  (generates `eas.json` with a `development` profile, `developmentClient: true`,
  `distribution: "internal"`).
- `app.json` needs bundle identifiers it doesn't have yet — `android.package` and
  `ios.bundleIdentifier` (e.g. `com.<name>.portfoliotracker`). Not needed for Expo Go,
  required for any real build.
- **Build path choice**: `eas build --profile development --platform android` (cloud,
  needs an EAS account, EAS manages Android signing) vs. `npx expo run:android` (local,
  free, needs Android Studio installed). iOS needs an Apple Developer Program account
  ($99/year) for anything beyond a 7-day local-device install via Xcode + a free Apple ID
  — a real cost/effort decision to make explicitly, not default into.
- EAS cloud builds don't see the local `.env` — `EXPO_PUBLIC_SUPABASE_URL`/
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` need to be set as EAS Secrets (or in `eas.json`)
  for cloud builds specifically; local builds are unaffected.
- Once built and installed once, add `portfoliotracker://**` to Supabase's Redirect URLs
  (replacing the fragile `exp://` entry) — permanent, one-time.
- A dev build only needs rebuilding when *native* dependencies change (new native
  packages, Expo SDK upgrades) — everyday JS/screen changes still hot-reload through
  Metro exactly like Expo Go does today.

**Investigation log (2026-08-16) — why this is now believed necessary, not just nice-to-have:**

Both magic-link and Google OAuth sign-in were tested repeatedly and failed identically —
every attempt landed on the Vercel production web app (logged in there) instead of
bouncing back into Expo Go, despite the redirect config being provably correct:

- Confirmed via `curl .../auth/v1/health`: this project's GoTrue (Supabase Auth) version
  is `v2.195.0` — recent, not a stale-version explanation.
- Confirmed via Supabase's own Auth Logs: the `/auth/v1/authorize?provider=google&
  redirect_to=exp%3A%2F%2F192.168.1.96%3A8081` request correctly received and encoded the
  exp:// redirect target (visible verbatim in the log's `event_message`).
- Confirmed the Redirect URLs allow-list contained both `exp://192.168.1.96:8081/**` and
  the bare `exp://192.168.1.96:8081` (no wildcard) — neither fixed it.
- Ruled out a real GoTrue bug found during research (`supabase/auth#2285`, custom schemes
  rejected by the *OAuth Dynamic Client Registration* endpoint) — that's a different
  feature (Supabase acting as an OAuth *provider*), not the `/authorize`→`/callback` flow
  this app uses, and that issue explicitly says standard auth flows (what we use) were
  already fixed to support custom schemes when allow-listed.
- Google's consent screen visibly renders and completes successfully — the failure is
  specifically in getting back *into* the app afterward.
- Magic-link testing hit Supabase's email rate limit before capturing the actual
  `/auth/v1/verify` log entry (the single request that both validates the OTP token and
  performs magic link's final redirect) — the true root cause was never confirmed with
  100% certainty from Supabase-side logs alone.

**Working theory — CONFIRMED (2026-08-16):** the root cause was the **Android OS / Chrome
intent-resolution layer**, not Supabase. `exp://<dynamic-LAN-IP>:<port>` was a much harder
target for Android to reliably recognize as "hand this to an installed app" than a real
app's own compiled-in custom scheme, since the host portion changes every dev session —
Chrome couldn't resolve a handler for it and just kept showing whatever was already loaded
in that tab (the Vercel site, from earlier testing). After building and installing an EAS
development build (`eas build --profile development --platform android`) with the stable
`portfoliotracker://` scheme registered as a real Android Intent Filter, both magic-link
and Google OAuth sign-in worked on the first attempt — no other change was needed, which
rules out a Supabase-side cause and confirms this was purely an Expo-Go-on-Android
limitation.

### Near-term (after multi-account support)
- [x] Uninvested capital tracking (COMPLETED ✅)
      - Created deposits table with RLS policies (supabase/migrations/0004_deposits_table.sql)
      - Built Deposits management UI (/app/settings/deposits/page.tsx)
        * Add, edit, delete deposits
        * Filter by account (ZAR/USD)
        * View total deposits per account
      - Integrated uninvested capital calculation in portfolio page
        * Formula: Total Deposits - (Share Investment + Fees)
        * Displayed in portfolio summary card
        * Color-coded (purple for positive, red for negative)
      - Added link to Deposits management in Settings page
      - **NOTE**: Migration needs to be applied manually via Supabase Dashboard SQL Editor
      - **NOTE**: Run `npm run gen:types` after applying migration to update TypeScript types
- [x] Theme implementation (Dark mode) (COMPLETED ✅)
      - Created ThemeProvider component (components/ThemeProvider.tsx)
        * Manages theme state (light, dark, system)
        * Syncs with user settings in database
        * Listens to system preference changes
        * Applies dark class to html element
      - Configured Tailwind CSS for class-based dark mode
        * Updated globals.css for dark theme support
      - Wired up theme switching in Settings page
        * Real-time theme changes
        * Persists to user_settings table
      - Added dark mode styles to Settings page
        * Background colors (dark:bg-gray-900, dark:bg-gray-800)
        * Text colors (dark:text-gray-100, dark:text-gray-400)
        * Border and hover states
      - **NOTE**: Additional pages can be styled with dark mode as needed using Tailwind's `dark:` prefix
      - **FIX (2026-08-14)**: Manual Light/Dark selection had no visual effect — the project
        runs Tailwind v4, which defaults `dark:` to the `prefers-color-scheme` media query and
        ignores `darkMode: 'class'` in tailwind.config.ts unless the config is loaded via
        `@config`. Added `@custom-variant dark (&:where(.dark, .dark *));` to globals.css to
        opt into class-based dark mode so ThemeProvider's `.dark` class toggle actually applies.
        Also fixed the theme-save upsert in ThemeProvider.tsx, which was overwriting the user's
        saved fee percentages with hardcoded defaults on every theme change.

### Quick Win #1: Transaction Notes & Tags (COMPLETED ✅)
- [x] **Database Migration**
      - Add `notes` text field to transactions table (nullable)
      - Add `tags` text[] array field to transactions table (nullable, default empty array)
      - Create migration: 0005_transaction_notes_tags.sql
      - Update TypeScript types via `npm run gen:types`
      - Created GIN index on tags for efficient filtering
- [x] **Transaction Forms**
      - Added "Notes" textarea to new transaction form (optional, placeholder: "e.g., Monthly contribution")
      - Added "Tags" input with predefined suggestions:
        * "dividend reinvest", "rebalance", "monthly contribution", "bonus investment", "emergency withdrawal", "lump sum", "dca", "correction buy"
        * Supports custom tag creation (type and press enter)
        * Max 5 tags with autocomplete
      - Added same fields to edit transaction form
      - Added same fields to historical transaction form
- [x] **Display & Filtering**
      - Shows notes in transaction detail view (transactions page expanded row)
      - Shows tags as colored badges in transactions table (primary variant)
      - Added tag filter input on transactions page (filter by tag text search)
      - Integrated tag filter with clear filters button
- [x] **UI Components**
      - Created reusable TagInput component (apps/web/components/TagInput.tsx)
        * Autocomplete with suggestions
        * Keyboard navigation (Enter to add, Backspace to remove)
        * Shows filtered suggestions as user types
        * Max tags limit enforcement
      - Created Tag badge component (apps/web/components/Tag.tsx)
        * 5 color variants: default, primary, success, warning, danger
        * Optional remove button with X icon
      - Full dark mode support for all new components

### Quick Win #2: Fee Breakdown Tooltip (Estimated: 30 minutes - 1 hour)
- [ ] **Portfolio Table Enhancement**
      - Add info icon (ⓘ) next to "Total Cost" or "Fees" column in holdings table
      - On hover, show tooltip with fee breakdown per ticker:
        * Commission fees: R X.XX
        * Deposit fees: R X.XX
        * FX fees: R X.XX
        * Other fees: R X.XX
        * Total fees: R X.XX (sum)
      - Calculate fees per ticker by summing from all transactions for that ticker
      - Use Headless UI Tooltip or similar library for accessible tooltip
      - Ensure responsive (click to show on mobile)
      - Add dark mode styling

### Medium Effort #3: Dashboard Improvements (Estimated: 3-4 hours)
- [ ] **Quick Stats Cards** (add to top of portfolio page, above holdings table)
      - Card 1: Today's Change
        * Calculate: (Current Value - Previous Day Value)
        * Show: R X.XX (+/-X.XX%)
        * Color code: green for positive, red for negative
        * Note: Requires storing/calculating previous day value (could use transactions dated before today as proxy)
      - Card 2: Cash Available
        * Show uninvested capital prominently
        * Include quick link to "Add Deposit" or "Invest Now"
      - Card 3: Rebalancing Status
        * Show ticker with largest drift % (positive or negative)
        * Example: "STXNDQ is 5.2% overweight" or "Target allocation met ✓"
        * Link to targets page
      - Card 4: Activity Summary
        * Days since last transaction
        * Total transactions this month
        * Link to "Add Transaction"
- [ ] **Visual Improvements**
      - Better card design with icons, shadows, hover effects
      - Improved typography hierarchy (bigger headings, consistent spacing)
      - More whitespace between sections
      - Responsive grid layout (2x2 on desktop, stacked on mobile)
- [ ] **Quick Actions Section**
      - Add prominent button row below stats cards:
        * "Add Transaction" (primary button, indigo)
        * "View Reports" (secondary button, when implemented)
        * "Calculate Rebalance" (secondary button, when implemented)
      - Sticky on scroll for easy access?

### Medium Effort #4: About Page (Estimated: 1-2 hours)
- [ ] **Create /about Page**
      - Route: apps/web/app/about/page.tsx
      - Responsive layout with good typography
      - Dark mode support
- [ ] **Content Sections**
      - Hero section:
        * Headline: "Fee-aware portfolio tracking for JSE investors"
        * Subheading: Brief value proposition
      - Mission section:
        * "Our Mission" heading
        * Text: Help South African investors maintain target allocations effortlessly
        * Explain the rebalancing problem and our solution
      - Features section:
        * "Key Features" heading
        * Cards or list with icons:
          - JSE-specific ticker database (45+ ETFs/stocks)
          - Dual account support (ZAR/USD)
          - Fee-aware cost basis calculations
          - Intelligent rebalancing signals
          - Uninvested capital tracking
          - Dark mode support
      - Privacy & Security section:
        * Row-level security (users only see their own data)
        * No third-party data sharing
        * Data stored in secure Supabase database
        * Open source codebase (if applicable)
      - Getting Started section:
        * Quick guide: Sign up → Add deposit → Add transaction → Set targets
        * Link to first transaction form
- [ ] **Navigation**
      - Add "About" link to main navigation
      - Add to footer (when footer exists)
      - Update metadata for SEO (title, description)

### Medium-term
- [ ] **Larger Feature #5: Portfolio Performance Charts** (Estimated: 1-2 days)
      - Chart Library Setup:
        * Install Recharts or Chart.js
        * Create reusable chart components
      - Historical Value Chart:
        * Line chart showing portfolio value over time
        * Calculate daily values based on transaction history + price data
        * Option to filter by date range (1M, 3M, 6M, 1Y, All)
        * Show today's value vs starting value
      - Profit/Loss Trends:
        * Separate chart for total P/L over time
        * Show both absolute (rand) and percentage
        * Highlight positive/negative periods
      - Performance Per Ticker:
        * Bar chart showing P/L % per ticker
        * Sort by performance (best to worst)
        * Color code: green for gains, red for losses
- [ ] **Larger Feature #6: Export Functionality** (Estimated: 2-3 hours)
      - CSV Export:
        * Export all transactions to CSV
        * Include all fields: date, ticker, shares, price, fees, notes, tags
        * Export portfolio summary (holdings, cost basis, current value, P/L)
        * Add "Export" button to transactions page and portfolio page
      - PDF Export (Optional - more complex):
        * Generate PDF report with portfolio summary
        * Include: holdings table, key metrics, charts (if available)
        * Use library like react-pdf or jsPDF
      - Tax Reporting Format:
        * CSV format suitable for tax reporting
        * Include: CGT calculations, dividends received (when implemented)
        * Group by tax year
- [ ] **Larger Feature #7: Dividend Tracking** (Estimated: 1 day)
      - Database Schema:
        * Add `dividend_amount` decimal field to transactions (nullable)
        * Add `transaction_type` enum: 'buy', 'dividend' (default 'buy')
        * Create migration: 0006_dividend_tracking.sql
      - Dividend Entry:
        * Add "Record Dividend" form (separate from regular transactions)
        * Fields: ticker, date, dividend amount (ZAR)
        * Link dividends to existing holdings
      - Display:
        * Show total dividends received per ticker in portfolio table
        * Calculate dividend yield: (Total Dividends / Cost Basis) × 100
        * Add "Dividends" tab to portfolio page
        * Show dividend history timeline
- [ ] **Larger Feature #8: Rebalancing Calculator** (Estimated: 1-2 days)
      - Algorithm:
        * Calculate drift for each ticker: (Current % - Target %)
        * Determine trades needed to minimize drift
        * Consider: Available cash, transaction fees, minimum trade sizes
        * Optimize for minimal transactions
      - UI:
        * "Calculate Rebalance" button on portfolio page
        * Modal/page showing recommended trades:
          - Ticker, Action (Buy/Sell), Shares, Estimated cost (including fees)
          - Total cash needed or released
          - Post-rebalance allocation preview
        * Option to execute trades manually (just shows suggestions)
        * Export rebalance plan to CSV/PDF

### Long-term
- [ ] One-time CSV bootstrap import
- [ ] Mobile app enhancements (Phase 3+)
      - Android build
      - iOS build
      - Push notifications for rebalancing alerts
- [ ] Predictions/analysis/nudges
- [ ] Multi-currency support beyond ZAR/USD
- [ ] API integrations for auto-sync with brokers

---

## Product & Marketing Strategy

### ASO & Keyword Analysis
**Target Platform:** Web-first, future mobile app (iOS/Android)
**Target Audience:** South African retail investors (beginners → experienced), JSE traders, rebalancing enthusiasts

**Target Keywords:**
- [ ] Research and document primary keywords:
      - Core: "JSE portfolio tracker", "South African investment tracker", "portfolio rebalancing"
      - Secondary: "EasyEquities tracker", "fee tracking investment", "target allocation portfolio"
      - Long-tail: "track JSE ETF portfolio", "rebalance investment South Africa", "ZAR USD portfolio tracker"
- [ ] Analyze competitors:
      - EasyEquities built-in tools (identify gaps)
      - Global apps: Personal Capital, Sharesight (identify local advantages)
      - Direct search for existing JSE-specific tools
- [ ] Document unique positioning:
      - JSE-specific ticker database (45+ ETFs/stocks)
      - ZAR/USD dual account support
      - Fee-aware cost basis calculations
      - Intelligent rebalancing signals
- [ ] SEO optimization tasks:
      - Meta descriptions for all pages
      - Update page titles with target keywords
      - Add structured data (JSON-LD) for rich snippets
      - Create content/help pages for long-tail keywords

**Note:** Mobile app store optimization (ASO) deferred until app launch phase

### Branding & Identity

**Current Status:**
- Name: "Portfolio Tracker" (functional, clear, SEO-friendly)
- Color scheme: Indigo/blue primary (modern, trustworthy)
- Value proposition: "Fee-aware portfolio tracking for JSE investors with intelligent rebalancing"

**Brand Development Tasks:**

- [ ] **Mission Statement & About Page**
      - Write clear mission: Help South African investors maintain their target allocations effortlessly
      - Document core features and benefits
      - Privacy and security stance (user data, RLS, no third-party sharing)
      - Add "About" page to website (/about)

- [ ] **Logo Design** (Optional - can defer)
      - Concept exploration:
        * Target/bullseye icon (represents target allocation)
        * Balance scales (represents rebalancing)
        * Pie chart with South African colors
        * Minimalist "PT" lettermark
      - Create favicon and app icons
      - Ensure scalability (16x16 to 512x512)

- [ ] **Color Scheme Refinement** (Optional)
      - Current: Indigo (#4F46E5) primary, grays, green/red for P/L
      - Consider: Adding South African green/gold accents as secondary colors?
      - Ensure WCAG AA accessibility standards
      - Document color usage guidelines

- [ ] **Tagline/Slogan Options** (Optional - brainstorm)
      - "Track every rand. Hit every target."
      - "Your portfolio, perfectly balanced."
      - "Rebalancing made effortless."
      - "Invest with precision."

- [ ] **Name Alternatives** (Deferred - revisit if needed)
      - Keep "Portfolio Tracker" unless compelling reason to change
      - Potential alternatives for future consideration:
        * RebalanceZA, Target Balance, Folio, Allocate, Maintain
      - Document decision criteria (memorability, SEO, domain availability)

**Monetization Strategy:** TBD (options: free/open source, freemium, subscription)

### UI/UX Enhancements

**Target Experience:** Mobile-responsive, beginner-friendly, data-dense without clutter

**Priority 1: Dashboard Improvements** (Estimated: 3-4 hours)
- [ ] Add quick stats cards at top of portfolio page
      - Today's portfolio change (value + percentage)
      - Cash available to invest (uninvested capital)
      - Next rebalancing action needed (most overweight/underweight ticker)
      - Days since last transaction
- [ ] Better data visualization
      - Consider: Simple pie chart for current allocation vs target
      - Consider: Bar chart showing drift per ticker
      - Use lightweight chart library (e.g., Recharts, Chart.js)
- [ ] Quick action buttons
      - Prominent "Add Transaction" button
      - "Calculate Rebalance" button (when implemented)
      - "Export Report" button
- [ ] Improve typography and spacing
      - Clearer visual hierarchy
      - Better use of whitespace
      - Consistent font sizes/weights

**Priority 2: Mobile Responsiveness** (Estimated: 4-6 hours)
- [ ] Optimize portfolio table for mobile
      - Card view option for small screens
      - Horizontal scroll for table view
      - Collapsible rows for detailed info
      - Sticky column headers
- [ ] Touch-friendly controls
      - Bigger tap targets (min 44x44px)
      - Swipe actions (swipe transaction to edit/delete)
      - Pull-to-refresh on lists
      - Bottom sheet modals instead of centered modals
- [ ] Navigation improvements
      - Consider bottom navigation bar for mobile
      - Hamburger menu with clear sections
      - Breadcrumbs for context
- [ ] Test on real devices
      - iOS Safari (iPhone 12+, SE)
      - Android Chrome (various screen sizes)
      - Tablet landscape/portrait
      - Document device-specific issues

**Priority 3: Onboarding & Empty States** (Estimated: 2-3 hours)
- [ ] Welcome flow for new users
      - Brief tour of key features (dismissible)
      - Highlight: Add deposit → Add transaction → View portfolio → Set targets
      - Optional: Sample data to explore before adding real transactions
- [ ] Improved empty states
      - Portfolio page (no transactions): Show what they'll see + CTA to add first transaction
      - Deposits page (no deposits): Explain uninvested capital + CTA to add deposit
      - Targets page (no targets): Explain rebalancing + CTA to set first target
      - Use illustrations or icons (not just text)
- [ ] Help/info tooltips
      - Explain complex metrics (Market P/L vs Total P/L, drift percentage, etc.)
      - "What is this?" links to help docs
      - Contextual help in forms

**Nice-to-Have Improvements:**
- [ ] Loading states: Skeleton screens instead of spinners
- [ ] Animations: Subtle transitions for better perceived performance
- [ ] Accessibility: Keyboard navigation, ARIA labels, screen reader testing
- [ ] Dark mode polish: Ensure all new features support dark mode
- [ ] Progressive Web App (PWA): Add to home screen, offline support

**UX Metrics to Track (Future):**
- Time to first transaction
- Feature discovery rate (do users find deposits, targets, etc?)
- Mobile vs desktop usage split
- Drop-off points in key flows

---

## Previously Completed

- [x] Enhance portfolio view to show investment cost basis vs current value
      - Added "Purchase Value" column (sum of shares × price_at_transaction per ticker)
      - Added "Current Value" column showing shares × current_price
      - Added "Profit/Loss" column showing absolute and percentage change
      - Color-coded gains (green) and losses (red)
      - Added total portfolio summary at top with Total Invested, Current Value, Total Profit/Loss, and Return %

## Design system v2 (2026-08-14, COMPLETED ✅)

Adopted a new visual design system from a workshop mockup (Barlow/Barlow Condensed
typography, "blueprint" wireframe card style with corner brackets, hairline borders,
tabular-mono figures) and rebuilt the app's chrome and Overview page around it.

- New tokens/component classes in `apps/web/app/globals.css` (`.btn*`, `.card`,
  `.field`/`.input`, `.seg`/`.seg-opt`, `.tag*`, `.blueprint`/`.corner`, `.table`, `.nav`, etc.)
- Deleted `apps/web/tailwind.config.ts` (inert under Tailwind v4) and the dead
  `apps/web/app/dashboard/page.tsx` route
- New shared `apps/web/components/Nav.tsx` mounted via `apps/web/app/(app)/layout.tsx`
  (a route group); every authenticated page moved under `app/(app)/` and had its
  duplicated inline header removed in favor of Nav
- Rebuilt `apps/web/app/(app)/page.tsx` (Overview) per the mockup: hero metrics,
  drift/cash/best-worst strip, real allocation donut, a real (simple, proportional)
  rebalance suggestion — all from existing data, no new schema
- Kept product name "Portfolio Tracker" (mockup's "HOLDFOLIO" rebrand not adopted)

**Deferred — mockup called for these but there's no data to back them yet:**
- Value-over-time and drift-over-time charts — need a `portfolio_snapshots`-style
  table (periodic value/drift snapshots); currently shown as "coming soon" placeholders
- "Goal" progress tracking — no goal-setting feature exists yet
- "TFSA this tax year" contribution tracking — no tax-year/contribution-limit feature yet
- "Customise cards" panel on Overview — shown as a disabled placeholder, not wired up
- Legacy `/portfolio` page and all secondary pages (Settings, Targets, Transactions,
  Deposits, Import) got Nav + a class restyle only — their layouts/content are unchanged
  from the mockup's perspective (mockup only fully specified Overview, sign-in, settings,
  add-transaction, plan, and CSV-import screens; the dense legacy `/portfolio` table view
  predates the mockup and wasn't in scope to redesign)

## Holdings page → mockup 1a (2026-08-15, COMPLETED ✅)

Rebuilt `apps/web/app/(app)/portfolio/page.tsx` ("Holdings" in Nav) to match mockup 1a
(Ledger) exactly, and backported the same treatment to Overview's holdings table:

- Ticker + description (via the new `getTickerName()` export in
  `packages/api-client/src/jse-tickers.ts`, also used by the Plan page)
- "Weight vs target" column using the `.weight-bar`/`.fill`/`.target` primitives, with a
  "Set target →" link (to `/targets`) replacing the old "No target" text for untargeted holdings
- Simplified default columns (dropped Fees / Share Value / Market P/L breakdown) with a
  "Show details" toggle on Holdings that brings them back; Overview stays simplified with
  no toggle (matches the smaller surface area appropriate for a landing page)
- Account filter (All/ZAR/USD, default All) added top-left of the Holdings table — this
  page never had one before
- "Portfolio growth" hero card (from mockup 1b) added above the existing summary card:
  real total value + real gain %, plus a real "N of M holdings near target" count

**Deferred — added to the UI per mockup, not wired up yet:**
- **Export CSV** button on the Holdings page — present but disabled ("Coming soon"); no
  export implementation exists
- **Growth chart** inside the 1b-style hero card — shown as a dashed "needs price
  history, coming soon" placeholder instead of the mockup's sparkline; same root cause
  as the Overview value-over-time chart above — needs a `portfolio_snapshots`-style table

## Sortable holdings + Holding detail page → mockup 2b (2026-08-15, COMPLETED ✅)

- Both holdings tables (Overview and `/portfolio`) are now sortable by clicking any
  column header (new `apps/web/components/SortableTh.tsx`, ▲/▼ indicator on the active
  column); click again to reverse direction
- Every holdings row is a link to a new detail page, `apps/web/app/(app)/portfolio/[ticker]/page.tsx`,
  matching mockup 2b: breadcrumb, header (ticker + overweight/underweight/on-target tag +
  price + Set target/Buy more actions), five stat cards (shares, avg cost, market value,
  unrealised P/L, fees paid), cost-vs-value bars, weight-vs-target bar with a real
  rebalance suggestion (shares to sell / Rand to add), tags aggregated from that ticker's
  transactions, and a per-ticker transactions table with Edit links
- "Buy more" and "Set target" on the detail page (and "Set target →" on the holdings
  tables) now carry `?ticker=&account=` context; `/transactions/new` reads it to prefill
  the ticker/account, and `/targets` reads it to queue a new target row — the user only
  has to fill in a number, not re-search for the ticker

**Deferred — shown in the UI, not wired up yet:**

- **Sell** button on the Holding detail page — disabled ("Coming soon"); this app has no
  sell/disposal transaction type at all yet (schema only models buys via positive share
  deltas), a bigger feature than this pass
- **Price chart** on the Holding detail page — dashed "needs price history, coming soon"
  placeholder, same root cause as the other deferred charts above
- **Interactive charts** (range-tab switching, hover tooltips/crosshair) — mockup's own
  "Open decisions" section leaves tooltip behavior undesigned; every chart in this app is
  currently a static "coming soon" placeholder anyway pending the `portfolio_snapshots`
  table, so there's nothing to make interactive yet. Once that table and the placeholder
  charts are real, revisit range-tab live re-slicing and hover tooltips (square-cornered,
  hairline-bordered, per the mockup's own guidance) as a follow-up.

## Transaction currency display → reflect account currency (2026-08-15, COMPLETED ✅)

- The three transaction forms (`transactions/new`, `transactions/new/historical`,
  `transactions/[id]/edit`) and `FeeBreakdown.tsx` now show `$` instead of `R` for the
  "Amount to Invest"/"Amount Invested" field (label, placeholder, hint text, and all fee
  inputs/summary) when the selected account is USD — `const currencySymbol = accountType
  === 'USD' ? '$' : 'R'`
- Deliberately display-only: this is a cosmetic symbol swap on the amount the user is
  putting into their own account, not real currency conversion. Share price quotes
  (`quote.price_zar`), the historical manual-price field, and original-transaction price
  in the edit page's hint text all stay labeled "R" — per the architecture, every quote
  is genuinely ZAR-denominated (the ZAc → ZAR division happens once in the Edge Function),
  so relabeling those would misrepresent the data, not just its display
- No FX conversion math exists anywhere in the codebase yet; see "Live FX rate fetching
  for USD transactions" below for the follow-up this implies

## Deposit fee relocated from transactions to deposits (2026-08-15, COMPLETED ✅)

- **Why**: a deposit fee (card ~2%, EFT ~0%) is charged when money enters an account, not
  when shares are bought — one monthly/ad hoc deposit funds many buys over time, so the
  fee never belonged to any single buy transaction. It's now tracked where it actually
  happens: on the deposit.
- **Migration** `0006_deposit_method_fee.sql` adds `deposit_method` ('card'/'eft', default
  'card') and `deposit_fee` (numeric, default 0) to `public.deposits`. **NOTE**: needs to
  be applied manually via the Supabase Dashboard SQL editor, same as prior migrations, and
  `database.types.ts` was hand-updated to match (no live `gen:types` run available here).
- **Fee model** (confirmed with user): the deposit amount is the *net* amount that lands
  in the account; the fee is a *separate, additional* cost charged on top by the bank —
  informational only, never deducted from the amount. So `uninvestedCapital = total
  deposits − cost basis` is unchanged; deposit fees don't reduce investable capital.
- **Removed** from `FeeBreakdown.tsx` and all three transaction forms (`transactions/new`,
  `transactions/new/historical`, `transactions/[id]/edit`): the Deposit Method dropdown,
  `depositFee` from `FeeBreakdownData`, and `deposit_method`/`deposit_fee` from
  insert/update payloads. `transactions.deposit_method`/`deposit_fee` columns are left in
  place (not dropped) — historical rows keep their real values and still feed the
  cost-basis/fee aggregates on Overview, `/portfolio`, and the Holding detail page
  unchanged; only new buys stop setting them (default to 0/'card').
- **Deposits page** (`settings/deposits/page.tsx`) gained the Method dropdown (same
  card/EFT + live % copy as the old transaction forms), an auto-calculated (editable) fee
  field, per-account fee totals, a Method/Fee column in the list table, USD amounts now
  show `$` instead of `R`, and a `?new=true` query param (wrapped in `Suspense`, matching
  the app's existing pattern) that auto-opens the add form — used by the new "+ Add
  Deposit" button on the Transactions page, which links to `/settings/deposits?new=true`
  rather than duplicating the form.
- The Transactions page's expanded fee-breakdown row now only shows the "Deposit" line for
  legacy transactions that still carry a nonzero `deposit_fee`, labeled "(legacy)".
- **Deployed**: migration applied to the live Supabase project (`portfolio-tracker`) via
  `supabase migration repair --status applied 0004 0005` (those two were already live from
  a prior manual SQL-editor apply, just untracked by the CLI) then `supabase db push` for
  0006. All 6 migrations now show as applied both locally and remotely.
- **Overview page fees visibility** (2026-08-15, follow-up): added a small breakdown
  caption under the "Total return after fees" hero card — `Investing: R{x} · Deposits:
  R{y}` — sourced from the existing tx-fee aggregation (`totalFeesPaid`) plus a new sum of
  `deposits.deposit_fee` (`totalDepositFees`). Deliberately kept as two separate numbers,
  not blended into one "total fees" figure: investing fees (commission/FX/other) are
  already baked into cost basis and affect the P/L% above it; deposit fees never touch a
  holding and would silently distort that % if merged in. Full detail (method, per-deposit
  fee, per-account totals) still lives on the Deposits page — this is just a "the fees you
  paid, in one place" summary.

## Sub-phase A (unified form + Withdrawal) shipped — see "Sell + Withdrawal Sub-phase A" below (2026-08-16)

Everything below this line was the pre-implementation scoping context. **Sub-phase A is now
built**: the unified Add screen, the merged Activity ledger, and Withdrawal are all live on
both platforms. Sell is still not implemented — see the new dated entry further down for
what shipped and what Sub-phase B (Sell itself) still needs.

## Future: unified "Add Transaction" screen + Activity ledger (Buy/Sell/Deposit/Withdrawal) → mockup 3e

Mockup 3e shows one entry screen with a Buy/Sell/Deposit segmented control at the top, but
**only the Buy variant is actually specified** (fee breakdown fields, FX/currency-
conversion panel for USD holdings) — Sell and Deposit are unlabeled tabs with no fields
designed, and Withdrawal isn't in the mockup at all. Explicitly deferred rather than
half-built, per user discussion on 2026-08-15:

- **No Sell/disposal feature exists yet** — the schema only models buys (positive share
  deltas). A working Sell tab means designing realized-gain accounting and share/cost-
  basis reduction from scratch — a materially bigger feature than a nav rename, not
  something to bolt on as a side effect of merging screens.
- **No Withdrawal feature exists yet either** (money leaving an account, the mirror of a
  deposit) — same story as Sell: needs its own design, not implied by the mockup.
- **Resolved**: where does the Deposits list live if Settings › Deposits goes away? Answer
  (agreed 2026-08-15): the Transactions page becomes a single "Activity" ledger — one
  filterable table showing all four movement types (buy/sell/deposit/withdrawal), each
  visually distinguished (tag/icon), with the "+ Add Transaction" button opening the one
  dynamic form for whichever type is selected. This also means Settings › Deposits can be
  retired once that lands, rather than kept as a second, parallel deposits list.

When this gets picked up, in order: build Withdrawal (mirrors Deposit, lowest lift) → build
Sell (bigger — realized gains, cost-basis reduction) → design Deposit's actual field set
(not speced in 3e) → merge Buy/Sell/Deposit/Withdrawal into one dynamic form with a type
selector → fold the Transactions page into the unified Activity ledger described above →
retire Settings › Deposits. Until then, keep today's separate, purpose-built entry points
(`/transactions/new`, `/transactions/new/historical`, `/settings/deposits`). Nav's CTA is
already relabeled "+ Add Transaction" (2026-08-15) ahead of this, since "+ Record a buy"
read oddly once the page itself covers more than buys conceptually.

**Roadmap placement (2026-08-16)**: confirmed this is what "the transactions redesign"
refers to in v1.1 planning. Sequenced *after* Mobile Milestone 1 (Foundation + Sign-in +
Overview) — still blocked on Withdrawal and Sell, neither started. No design or
implementation work happened on this in the v1.1 pass that added the landing page,
Danger Zone, and tooltips.

## Add-transaction screen realigned with mockup 3e (2026-08-15, COMPLETED ✅)

- `/transactions/new` restyled to match 3e: title "Add a Transaction", Buy/Sell/Deposit
  segmented control (Buy active; Sell disabled "Coming soon" — same pattern as the Holding
  detail page's disabled Sell button; Deposit links to `/settings/deposits?new=true`),
  Date/Currency 2-col grid (Currency now a `.seg` ZAR/USD control instead of a dropdown),
  ticker field shows the resolved ticker's name once known (via `getTickerName`, same
  helper already used on `/targets`), and an accent-wash "You'll pay in total" card
  showing the grand total + shares received. Buttons relabeled "Save this buy" at a 1:2
  Cancel:Save ratio, matching 3e.
- `FeeBreakdown.tsx` (shared by all three transaction forms) rewritten from raw Tailwind
  gray boxes into the actual blueprint design system: `Card`, `card-kicker` label, mono
  figures, hairline divider before "Total fees." Historical/edit forms inherit this
  restyle automatically with no behavior change (they still show their own fee-inclusive
  summary; `new` passes `hideTotalSummary` since it has its own bigger total card).
- **Fee-row layout + "Edit rates"** (2026-08-15 refinement): each fee line (Commission, FX,
  Other) is now a single inline label/value row, matching 3e's static display exactly,
  instead of a full-width `.field` + input per fee. A new "Edit rates" toggle button in the
  card header swaps the read-only values for inline editable inputs — read-only by default
  is the 3e-accurate state; editability is preserved as a deliberate toggle rather than
  always-on, since real fee overrides are a real need this app has that the static mockup
  didn't need to solve.
- **Fee model: fees add on top** (confirmed 2026-08-15, matches EasyEquities' real buy
  flow) — the amount typed is the trade value that buys shares (`shares = amount / price`,
  unchanged from the original build); fees are calculated on that amount and *added* to
  reach what actually leaves the account. A prior pass in this same session briefly flipped
  this to a "fees deducted from amount" model, which was wrong — reverted back to additive
  before it shipped. The "You'll pay in total" card = amount + fees; `FeeBreakdown`'s own
  summary (historical/edit) shows Investment Amount → Total Fees → Total Cost (additive).
- **Statutory fee breakdown added** (2026-08-15, matches real EasyEquities JSE buy costs):
  `FeeBreakdown.tsx` now itemizes the full real fee stack instead of just commission —
  Settlement & administration (0.075%), Investor protection levy & administration
  (0.0002%), VAT (15%, levied on commission + settlement + IPL, not on the transfer tax),
  and Securities transfer tax & admin (0.25%) — each auto-calculated, each individually
  overridable via "Edit rates" like commission already was. Rates are hardcoded constants
  in `FeeBreakdown.tsx` for now, not user-configurable (see "Configurable statutory fee
  defaults" below). New `transactions` columns via migration `0007_statutory_fee_columns.sql`
  (applied to the live project): `settlement_admin_fee`, `ipl_admin_fee`,
  `securities_transfer_tax_fee`, `vat_fee`. Every place that sums a transaction's fees
  (Overview, `/portfolio`, Holding detail, Transactions list) updated to include them, so
  cost basis / P/L / "Total fees" displays stay accurate rather than silently undercounting.
- **Notes/Tags restyled to match** (2026-08-15 refinement): `TagInput.tsx` and `Tag.tsx`
  were still raw, never-restyled Tailwind (rounded-full pills, gray-100/indigo-100 chips) —
  rewritten to the design system's `.field`/`.input` wrapper and `.tag`/`.tag-accent`
  classes, so the Tags field now looks like every other field (including Notes, whose label
  was simplified from "Notes (optional)" to just "Notes" — optionality is already implied
  by every other optional field in the app not saying so).
- **Ticker description inline in the field** (2026-08-15 refinement) — once a ticker
  resolves to a known name, it now renders inside the same search input (absolutely
  positioned, muted, right-aligned, matching 3e's single combined box) rather than as
  separate helper text below the field.

## Sell + Withdrawal, Sub-phase A: schema, unified form, merged Activity ledger, Withdrawal (2026-08-16, COMPLETED ✅)

Full scoping plan was written and approved before implementation (the plan captured three
decisions: average cost for realized gains when Sell eventually lands, build the unified
form now rather than dedicated screens, Withdrawal ships before Sell). This entry covers
what actually shipped. Sub-phase B (enabling Sell itself) is separately scoped below —
not started.

- **Migration `0008_withdrawal_and_sell_types.sql`** (applied to the live project): adds
  `movement_type` ('deposit'/'withdrawal', default 'deposit') to `deposits`, and
  `transaction_type` ('buy'/'sell', default 'buy') to `transactions`. Both additive with
  safe defaults — no backfill needed. `amount`/`shares` stay **always positive**; direction
  lives only in the type column, never as a sign flip, so every existing sum/aggregate
  across both platforms kept working unchanged. Table names were deliberately *not*
  changed (e.g. to `cash_movements`) — renaming would touch RLS policies, every query, and
  both codebases' generated types for a name no user ever sees.
- **`packages/api-client/src/portfolio-calc.ts`**: `calculatePortfolio()`'s deposit
  aggregation now subtracts withdrawals instead of just summing `amount`, so
  `uninvestedCapital` correctly reflects money that's left an account. Sell math
  deliberately **not** touched yet — a comment marks where chronological/average-cost
  handling needs to go for Sub-phase B.
- **Web unified Add screen** (`/transactions/new`): one screen now covers Buy, Deposit, and
  Withdrawal via a 4-option segmented control (Sell present, disabled, "Coming soon" — same
  treatment it already had). Deposit/Withdrawal render inline instead of Deposit linking
  out to a separate page. The "historical purchase" toggle folds in what used to be the
  separate `/transactions/new/historical` page (custom date + manual/auto price mode) —
  that route is deleted, along with `/settings/deposits`.
- **Web Activity ledger** (`/transactions`, rewritten): merges transactions and deposits
  into one chronologically-sorted, filterable table (Type/Account/Ticker/Tag filters),
  replacing the old transactions-only table. Buy rows keep the existing expandable
  fee-breakdown; Deposit/Withdrawal rows show a Type tag and link to a new
  `/deposits/[id]/edit` page (mirrors `/transactions/[id]/edit`'s Cancel/Delete/Save
  pattern, adds a Deposit/Withdrawal toggle so a miscategorized row can be corrected).
- **Mobile unified Add screen** (`transactions/new.tsx`): same 4-option segmented control:
  the `kind === 'deposit'` redirect to `/deposits/new` is gone — Deposit/Withdrawal fields
  render inline. `AddActionSheet` gained a Withdrawal row; `deposits/new.tsx` is deleted,
  all its callers (Deposits list, Activity's "+ Add deposit") now point at
  `/transactions/new?kind=deposit` (or `?kind=withdrawal`).
- **Mobile Activity screen**: now unions three kinds instead of two (`transaction` /
  `deposit` / `withdrawal`); tapping a Deposit/Withdrawal row navigates straight to
  `deposits/[id]/edit.tsx` (no expand step, since there's no fee breakdown to show —
  Buy rows still expand-then-edit, matching Milestone 5's pattern).
- **`deposits/[id]/edit.tsx`** (mobile) gained the same Deposit/Withdrawal toggle as web's
  new edit page, plus conditional labels (method field only shown for Deposit, fee label
  reads "Withdrawal fee" when relevant). The standalone Deposits screen
  (`app/deposits/index.tsx`, reachable from More) was updated to show a net total
  (deposits − withdrawals, was previously just summing everything as if it were all
  deposits) and tag withdrawal rows distinctly.
- **Verification performed**: `tsc --noEmit` clean on both apps throughout, in the same
  incremental steps this was built in (migration → calc engine → web forms → web ledger →
  mobile forms → mobile ledger). `npx expo export --platform android` compiled clean, Metro
  restarted fresh for the route changes. Web routes smoke-tested via `curl` (307 redirects
  to `/login`, confirming no server errors — full manual click-through still needs a real
  logged-in pass on both platforms).
- **Not built (Sub-phase B, scoped but not started)**: any Sell functionality. When picked
  up: extend `calculatePortfolio()` to process each ticker's transactions in date order
  maintaining a running average-cost-per-share, so a sell's realized gain reflects the cost
  basis *as of that sale* — computed dynamically, not stored on the row, so editing an
  earlier buy can never leave a stale realized-gain figure behind (the same
  derive-don't-cache principle the rest of this calc engine already follows for
  weight%/drift%/P&L). Then: enable the Sell option in the already-shipped unified form,
  un-disable every "Sell"/"Buy more" affordance already stubbed in the UI (Holding detail,
  Holdings row actions, `AddActionSheet`), validate shares sold can't exceed shares held,
  show realized gain per sale in the Activity row. A portfolio-wide realized-gains summary
  on Overview is a candidate fast-follow, not required to ship Sell itself.

## Sell + Withdrawal, Sub-phase B: Sell is live on both platforms (2026-08-16, COMPLETED ✅)

Closes out the "biggest functional gap" — positions can now be closed, not just opened.

- **`packages/api-client/src/portfolio-calc.ts`** rewritten around a new
  `calculateTickerPosition()`: replays one ticker's transactions in date order, average-cost
  method — a sell reduces shares and cost basis proportionally to the running average cost
  per share at that point in the history (`shareValueRemoved`/`feesRemoved` scaled by
  `sellShares / shares`), never a specific lot. Verified against a hand-computed scenario
  (two buys at different prices, one partial sell) before wiring it into anything —
  numbers matched exactly. `calculatePortfolio()` now groups transactions by ticker and
  calls this once per ticker instead of a flat sum; `getActiveTickers()` subtracts sell
  shares instead of just summing (with a 1e-6 epsilon so float dust from a fully-closed
  position can't keep it "active"). New `calculateRealizedGains(transactions)` — no prices
  needed, since a sale's gain is fully determined by historical data — lets Activity
  screens show a per-sale figure without fetching quotes. Realized gain is **computed
  fresh every time, never stored on the transaction row**: it depends on the full
  chronological history up to that sale, so if an earlier buy is later edited or deleted,
  a stored figure would silently go stale. Same principle this file already used for
  weight%/drift%/P&L.
- **`packages/api-client/src/fee-calc.ts`**: `calculateStatutoryFees()` gained a
  `transactionType` parameter (defaults `'buy'`, so every existing call site is
  unaffected) — a sell zeroes out Securities Transfer Tax. SA's Securities Transfer Tax
  Act charges this on purchases; brokers (EasyEquities included) don't charge it on
  sells. VAT is unaffected either way since it's charged on the brokerage service fee
  itself, not the trade direction. Both web's `FeeBreakdown.tsx` (which has its own
  inline fee logic, doesn't call the shared function) and mobile's `FeeBreakdownCard.tsx`
  got the same `transactionType` prop, hiding the STT row entirely for sells rather than
  just showing R0.00.
- **Sell enabled in the unified Add screen**, both platforms: picking Sell shows a list
  of currently-held tickers (computed via `calculateTickerPosition`, not a free-text
  search like Buy — you can only sell what you actually hold), shares-to-sell bounded by
  shares owned with a "Sell all" shortcut, the same Get Quote flow as Buy, a
  sell-mode fee breakdown, and a live realized-gain preview (green/red) before saving.
- **Every previously-stubbed Sell affordance is now wired**: Holding detail's Sell button
  (both platforms) links to `/transactions/new?kind=sell&ticker=X&account=Y`;
  `AddActionSheet`'s Sell row; the unified form's segmented control no longer blocks
  selecting Sell.
- **Both Activity ledgers** (web's merged `/transactions` table, mobile's
  `(tabs)/activity.tsx`) show Sell as its own tagged type (loss-tinted, distinct from
  Buy), and the expanded fee-breakdown row for a sell now shows its realized gain/loss
  and omits the Securities Transfer Tax line instead of showing it as R0.00.
- **Both transaction edit pages** (`/transactions/[id]/edit` on web,
  `transactions/[id]/edit.tsx` on mobile) now load `transaction_type` and pass it through
  to the fee-breakdown component and field labels ("Amount to invest" → "Amount received",
  "Shares to purchase" → "Shares sold") — previously editing an existing sell would have
  silently shown/recalculated Securities Transfer Tax on it, since the edit forms
  predated Sell entirely and always assumed a buy. Caught this while wiring up "Edit"
  from the Activity ledger onto sell rows, not something that shipped broken.
- **Verification performed**: the calc engine change was checked against a hand-computed
  scenario in an isolated script before being wired into any UI (see above). `tsc
  --noEmit` clean on both apps after each step. `npx expo export --platform android`
  compiled clean; Metro restarted fresh. Web routes smoke-tested via `curl` (redirects to
  `/login`, no server errors) — full manual click-through on both platforms is the next
  step before this gets merged to `main`.
- **Not built**: a portfolio-wide realized-gains summary on Overview (each platform's
  Overview still only shows unrealized P&L — `totalRealizedGain` is computed and
  available on `PortfolioCalcResult` but not yet surfaced there); FIFO/lot-level cost
  basis (average cost was the explicit decision, see the scoping plan above); CSV import
  support for Sell rows.

## Future: Configurable statutory fee defaults (per user, maybe per account)

The four statutory fee rates added above (settlement & admin, IPL & admin, VAT, securities
transfer tax) are hardcoded constants in `FeeBreakdown.tsx`, unlike commission and FX
which already live in `user_settings` and are editable on the Settings page. Flagged as a
follow-up (not built) since these rates: (a) are set by the JSE/regulator/SARS and rarely
change, so hardcoding them isn't wrong today, but (b) users may reasonably want to tune
them if their broker's real fees differ slightly, and (c) some brokers structure these
differently per account (e.g., a ZAR vs. USD account, or different broker relationships) —
hence "maybe even by account" rather than a single global default. When picked up: add
columns to `user_settings` (or a new per-account fee-profile table if the per-account need
is real), surface them on the Settings page next to commission/FX, and have
`FeeBreakdown.tsx` read from `userSettings` instead of its local constants.

**Deferred from this pass — logged separately, not built:**

- **Weight-impact preview** ("how this buy/sell affects your plan," e.g. mockup 3e's
  "STXNDQ weight after this buy: 28.7% → 31.2%") — needs the page to fetch current
  holdings and targets for the ticker being transacted (this form is currently
  standalone, no portfolio-state awareness), then compute weight-before/after live as
  the user types an amount. Worth doing — it's exactly the kind of real-time feedback 3e
  is going for — but is a real data-fetching feature, not a style tweak, so it's tracked
  here rather than bolted on. Natural to build alongside the "unified Add Transaction"
  work above, since Sell will need the same weight-impact math (shares going down
  instead of up).

## Future: Charts + interactivity (2026-08-16, not built — recommendation below)

Every "coming soon" placeholder left in the app is a chart, all blocked on the same missing
piece: historical price data. Full current inventory:

- Web Overview (`app/(app)/page.tsx:326-334`): value-over-time and drift-over-time charts
- Web Holdings (`app/(app)/portfolio/page.tsx:298-308`): portfolio growth sparkline
- Web Holding detail (`app/(app)/portfolio/[ticker]/page.tsx:256`): price since first buy
- Web Overview (`app/(app)/page.tsx:391`): "pick which cards/charts appear" dashboard
  customization — a related but separate interactivity feature, not blocked on price
  history
- Mobile Overview (`(tabs)/index.tsx:255`) and Holding detail (`holding/[ticker].tsx:158`):
  same two chart types, same blocker

**Recommendation: this is more buildable than it looks, and web/mobile should be scoped
very differently.**

The "needs price history" blocker turns out to be smaller than a from-scratch data
pipeline. `supabase/functions/get-quote/index.ts` already calls Yahoo Finance's
`/v8/finance/chart/{ticker}.JO` endpoint — the *same* unofficial endpoint (per its
well-known public shape) also accepts `range`/`interval` query params
(e.g. `range=1y&interval=1d`) and returns a full historical close-price series, not just
the latest tick. `get-quote` only reads `result.meta.regularMarketPrice` today and
ignores the rest of the payload. This means real historical prices are very likely
available with no new data source, no accumulation table, and no backfill problem — just
a new Edge Function (`get-price-history`, kept separate from `get-quote` rather than
overloading its contract, per the architecture doc's "isolate the price-fetch call" — read
architecture doc §3 rationale) requesting a range instead of the current tick. **Worth a
short spike to confirm the range params actually return what's expected for `.JO` tickers
specifically before committing to this as the real plan** — the unofficial endpoint's
behavior for JSE-listed instruments hasn't been verified for this query shape the way the
current-price shape was (see architecture doc §3's validation script).

**Web**: build now, once the spike above confirms the data is real. No new dependency
needed for basic line/area charts — either a lightweight lib (e.g. `recharts`, `visx`) or
hand-rolled SVG sparklines (web has no native-build constraint, so this is a much lower-
stakes choice than on mobile). Sequencing: portfolio value-over-time on Overview first
(highest value, one chart covers the whole portfolio), then per-holding price-since-
first-buy on Holding detail, then drift-over-time and the Holdings growth sparkline.
Interactivity: standard hover tooltips showing the value/date at a point — cheap with any
of the above libraries.

**Mobile: defer.** Any real line/area chart needs SVG or Skia rendering — this project
deliberately has no `react-native-svg` (Milestone 4's tab icons are plain `View`s
specifically to avoid a native module that would force an EAS rebuild). Adding real
charts means finally spending that rebuild. Recommendation: **batch it with the other
already-deferred native addition** (a real date picker, `@react-native-community/
datetimepicker`, logged in Milestone 3) rather than burning a second rebuild — pick a
charting library that needs `react-native-svg` (e.g. `victory-native` or `react-native-
svg-charts`) and add both native deps in one EAS build. Until that rebuild happens, the
mobile allocation breakdown on Overview already shows one viable non-SVG pattern (a plain
`View`-based horizontal stacked bar) — the same trick could stretch to a very simple
bar-per-period "value over time" view without SVG at all, if a stopgap is wanted before
the rebuild is worth spending. Interactivity on mobile once charts exist: tap-to-reveal a
value/date label (not hover — no cursor on touch), same pattern already used for
Activity's tap-to-expand fee rows.

**Dashboard customization** ("pick which cards/charts appear," web Overview only) is
scoped separately since it's not blocked on price history — needs a per-user layout
preference (new `user_settings` column or its own table) and conditional rendering of the
existing cards. Lower priority than the charts themselves; only worth doing once there
are enough cards/charts on Overview that customization is actually useful.

## Future: Responsive web app for mobile browsers (2026-08-17, not built)

`apps/web` has **zero `@media` queries anywhere** in `globals.css` — confirmed by grep,
not an assumption. Every page uses fixed-cap-width containers (`maxWidth: 620/720/1000/
1160`, which do shrink on narrow viewports since they're a *cap* not a fixed width) built
around layouts that don't reflow at small widths: multi-column CSS grids with a hardcoded
column count (Overview's hero row, LandingPage's feature grid, Settings' fee-defaults
grid), wide `<table>` elements with many columns (Holdings, Activity — currently only
escape via `overflow-x: auto`, i.e. horizontal scrolling, not a real mobile layout), and
`Nav.tsx`'s horizontal link row with no collapse-to-menu behavior at all.

**Worth separating into two different priorities, not one blob of work:**

- **The public landing page (`/`, `components/LandingPage.tsx`)** — genuinely worth fixing
  regardless of the native app's existence. Anyone can land here from a phone browser
  (a shared link, a search result) before ever deciding whether to install anything, and
  a broken-looking landing page on the device most people browse from undermines the
  first impression the whole page exists to make. Low risk, contained to one file.
- **The authenticated app pages** (Overview, Holdings, Activity, Add Transaction, Plan,
  Settings) — lower priority now that the native mobile app covers this exact need for
  anyone actually using the product day-to-day on a phone. Worth doing eventually for
  completeness (someone might prefer the web app even on mobile, or not have the native
  build installed), but not urgent the way the landing page is, and it's real,
  page-by-page work — every fixed grid, the Nav, and both wide tables need their own
  responsive treatment, not a single global fix.

**When picked up**: add real breakpoints to `globals.css` (a small set of shared
`@media` rules, not per-page one-offs), collapse `Nav.tsx` to a hamburger/menu pattern
below some width, turn the Holdings/Activity tables into a stacked-card layout below that
same breakpoint (matching the pattern the native mobile app's Activity screen already
uses — card-per-row instead of table columns — so there's a proven layout to copy rather
than designing one from scratch), and make every hardcoded `repeat(N, 1fr)` grid
single-column below the breakpoint.

## v1.1: landing page, data deletion, tooltips (2026-08-16, COMPLETED ✅)

- **Public landing page at `/`**: `/` is dual-purpose now rather than moved to a new URL —
  9+ places in the app assumed `/` means "authenticated home" (`router.push('/')`,
  `href="/"`), so moving Overview elsewhere would have rippled everywhere for no real
  benefit. Instead: `lib/supabase/middleware.ts` lets `/` through unauthenticated (was
  only `/login`/`/auth` before), `app/(app)/page.tsx` checks auth before fetching any
  data and renders the new `components/LandingPage.tsx` when logged out, and `Nav.tsx`
  renders nothing when there's no user so the authenticated app chrome never leaks to a
  logged-out visitor. Landing content is real copy grounded in shipped features (fee
  breakdown, target-weight planning, multi-account, deposits) plus an illustrative
  (clearly-labeled, not-a-real-screenshot) preview table — no fabricated screenshots,
  since there's no way to capture authenticated screens without real login credentials.
  **Gotcha hit**: reusing the raw `.nav`/`.nav a` CSS classes for the landing page's own
  header washed out the "Log in" button, because `.nav a` (class+element selector) has
  higher specificity than `.btn-primary` (single class) and its `opacity: 0.6` link-dim
  rule won. Fixed by not reusing `.nav` for a non-Nav header — replicated the layout
  inline instead.
- **Settings → Danger Zone**: "Clear My Data" (client-side deletes across `transactions`/
  `targets`/`deposits`, plus `user_settings`, keeps the login) and "Delete My Account"
  (new `supabase/functions/delete-account` Edge Function, deployed). Both require typing
  a confirm word (CLEAR / DELETE) rather than a plain `confirm()`, given the severity.
  The Edge Function is the app's first use of the Supabase **service role key** — it's
  never client-exposed; `SUPABASE_SERVICE_ROLE_KEY` is auto-injected into every Edge
  Function by Supabase, not something manually configured. Deleting the auth user via
  `auth.admin.deleteUser` cascades to all four data tables automatically (each already had
  `on delete cascade` from day one). Verified: calling the function without a valid JWT
  returns 401 (Supabase's default platform-level JWT verification, not custom code).
- **`Tooltip` component** (`components/Tooltip.tsx`): hover/focus-triggered, accessible
  (`role="tooltip"`, `aria-describedby`), matches the blueprint design system. Applied to
  the "Total P/L" / "P/L" column headers (explains "after fees" — the exact nuance behind
  shortening that label a while back) on both the Overview and `/portfolio` holdings
  tables, and to the three statutory fee labels in `FeeBreakdown.tsx` (Settlement & admin,
  Investor protection levy, Securities transfer tax), using the real EasyEquities fee
  descriptions supplied earlier rather than invented text. This is a starting scope, not
  exhaustive — more spots can be added as they come up.
- **Not done in this pass** (see "Future: unified Add Transaction..." above and Mobile
  Milestone 1 below): onboarding (explicitly future, not designed), the transactions
  redesign (placement confirmed, no work), native mobile app.

## Deferred (explicitly out of scope for now)

- Multi-user support beyond single-user RLS

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

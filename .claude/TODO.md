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
        * Updated tailwind.config.ts with darkMode: 'class'
        * Updated globals.css for dark theme support
      - Wired up theme switching in Settings page
        * Real-time theme changes
        * Persists to user_settings table
      - Added dark mode styles to Settings page
        * Background colors (dark:bg-gray-900, dark:bg-gray-800)
        * Text colors (dark:text-gray-100, dark:text-gray-400)
        * Border and hover states
      - **NOTE**: Additional pages can be styled with dark mode as needed using Tailwind's `dark:` prefix
- [ ] **NEW**: Transaction notes/tags
      - Add optional notes field to transactions
      - Add tags for categorization (e.g., "dividend reinvest", "rebalance")
      - Filter transactions by tags

### Medium-term
- [ ] Portfolio performance charts
      - Historical value over time
      - Profit/loss trend graph
      - Performance per ticker comparison
- [ ] Export functionality
      - Export transactions to CSV
      - Export portfolio summary to PDF
      - Tax reporting format
- [ ] **NEW**: Dividend tracking
      - Add dividend_amount field to transactions (optional)
      - Track total dividends received per ticker
      - Show dividend yield in portfolio view
- [ ] **NEW**: Rebalancing calculator
      - Given current drift and target weights, calculate exact shares to buy/sell
      - Consider fees in rebalancing suggestions
      - One-click rebalancing plan generation

### Long-term
- [ ] One-time CSV bootstrap import
- [ ] Mobile app enhancements (Phase 3+)
      - Android build
      - iOS build
      - Push notifications for rebalancing alerts
- [ ] Predictions/analysis/nudges
- [ ] Multi-currency support beyond ZAR/USD
- [ ] API integrations for auto-sync with brokers

## Previously Completed

- [x] Enhance portfolio view to show investment cost basis vs current value
      - Added "Purchase Value" column (sum of shares × price_at_transaction per ticker)
      - Added "Current Value" column showing shares × current_price
      - Added "Profit/Loss" column showing absolute and percentage change
      - Color-coded gains (green) and losses (red)
      - Added total portfolio summary at top with Total Invested, Current Value, Total Profit/Loss, and Return %

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

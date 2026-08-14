# TODO — Portfolio Tracker

Live, granular next-actions list. Phase-level status lives in `Execution_Roadmap.md`;
full design context lives in `portfolio-tracker-architecture.md`; stack conventions
live in `Stack_Playbook.md`. This file is the "what do I do right now" list.

**If you're Claude Code picking this up fresh**: read `portfolio-tracker-architecture.md`
§7 (Build Log) first for full context on what's already been decided and built, then
come back here for the immediate next steps.

---

## 🎯 Recommended Next Steps (Prioritized)

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

### Quick Win #1: Transaction Notes & Tags (Estimated: 1-2 hours)
- [ ] **Database Migration**
      - Add `notes` text field to transactions table (nullable)
      - Add `tags` text[] array field to transactions table (nullable, default empty array)
      - Create migration: 0005_transaction_notes_tags.sql
      - Update TypeScript types
- [ ] **Transaction Forms**
      - Add "Notes" textarea to new transaction form (optional, placeholder: "e.g., Monthly contribution")
      - Add "Tags" multi-select dropdown with predefined options:
        * "dividend reinvest", "rebalance", "monthly contribution", "bonus", "emergency withdrawal"
        * Allow custom tag creation (type and press enter)
      - Add same fields to edit transaction form
      - Add same fields to historical transaction form
- [ ] **Display & Filtering**
      - Show notes in transaction detail view (transactions page expanded row)
      - Show tags as colored badges in transactions table
      - Add tag filter dropdown on transactions page (filter by selected tags)
      - Add search by notes (text search in filter section)
- [ ] **UI Components**
      - Create reusable TagInput component with autocomplete
      - Create Tag badge component with color variants
      - Ensure dark mode support for all new components

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

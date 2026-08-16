# Handoff: Portfolio Tracker — overview, holdings, and supporting screens

Target repo: `pan3ng/portfolio-tracker` (`apps/web`, Next.js App Router + Tailwind, `darkMode: 'class'`).

## Overview

Ten screens for a DIY-investor portfolio tracker: an overview landing page carrying the key
metrics, a holding detail page with charts and full transaction history, and the supporting
flows (first run, sign in, record a transaction, target weights, CSV import, settings).
Light and dark. Desktop and mobile. ZAR-first with multi-currency FX.

The data model is the repo's own (`packages/schemas/src/index.ts`): transactions carry
`ticker, date, shares, price_at_transaction, total_fees`; targets carry `target_weight_pct`
and must sum to 100; holdings are derived (`current_value`, `current_weight_pct`,
`drift_pct = current_weight_pct - target_weight_pct`). Prices are stored in ZAR — the
ZAc → ZAR division happens once in the Edge Function, never in the UI.

## About the design files

`mockups/Portfolio Screen Options.dc.html` is a **design reference**, not production code.
It is a single streaming HTML document containing every screen side by side on a canvas,
each labelled with a stable id (`1a`, `2b`, `3e`…). Open it in a browser.

Recreate these screens in `apps/web` using React Server/Client Components + Tailwind as the
repo already does. Do not port the HTML wholesale, and do not copy its inline styles: the
inline styling is an artefact of the mockup medium. Take the **tokens and the measurements**
from this README and `tokens.css`, and express them however the codebase prefers (Tailwind
theme extension is the natural home — see "Wiring into Tailwind" below).

## Fidelity

**High-fidelity.** Colors, type, spacing, and chart geometry are final. Copy is final and
deliberate — it is plain-language by design ("What your investments are worth", not "NAV").
Recreate pixel-closely. The only intentionally loose parts: chart data is fabricated sample
data, and hover/tooltip behaviour on charts is unspecified (see "Open decisions").

## Design system

The visual system is **Industry** — a wireframe/blueprint aesthetic. `industry-styles.css`
in this bundle is the complete, authoritative token + component sheet. Its rules:

- Steel-blue accent `#5980a6` on a light technical ground `#f2f2f3`. Mono palette — no
  second accent. The only additions are the finance pastels in `tokens.css`.
- **Square corners.** Cards, buttons, inputs, tags: `border-radius: 0`.
- **Cards are line drawings, not filled surfaces**: transparent background, 1px hairline
  border, no shadow by default. The solid accent primary button is the one filled object.
- Every framed object wears four `+` registration marks at its corners (`.blueprint` +
  four `<i class="corner tl|tr|bl|br">` children). Never drop them.
- Barlow Condensed 600 for headings and all numerals; Barlow 400 for body.
- Icons: Lucide, stroke-width 1.5.
- Focus is always `outline: 2px solid var(--color-accent); outline-offset: 2px`.

## Design tokens

### Colors — light (from `industry-styles.css` `:root`)

| Token | Hex | Use |
| --- | --- | --- |
| `--color-bg` | `#f2f2f3` | page ground |
| `--color-surface` | `#e9e9ea` | inputs only (cards stay transparent) |
| `--color-text` | `#1d1f20` | all copy |
| `--color-divider` | `#1d1f20` @ 16% | every hairline border |
| `--color-accent` | `#5980a6` | accent, primary button fill, chart series 1 |
| accent ramp | `#eef6ff` `#d6ebff` `#b5d9fd` `#94bce3` `#749dc4` `#597ea3` `#416180` `#2c455d` `#1d2d3d` | 100→900 |
| neutral ramp | `#f5f5f8` `#e7e7ea` `#d4d4d7` `#b7b7ba` `#98989b` `#7a7a7d` `#5d5d60` `#424244` `#2b2b2d` | 100→900 |

Accent text at paragraph size must use `--color-accent-700` `#416180`, not the base accent
(the base is tuned to 3:1 — chrome and large text only).

### Colors — app additions (`tokens.css`)

| Role | Light | Dark |
| --- | --- | --- |
| gain text | `#3f7a63` | `#9ccdb6` |
| gain fill | `#8fb7a4` | `#6f9e86` |
| gain tint (card wash) | `#e2efe8` | `rgba(156,205,182,.10)` |
| loss text | `#9d5f68` | `#d9a3ab` |
| loss fill | `#c79aa1` | `#a8737d` |
| loss tint | `#fbf1f2` | `rgba(217,163,171,.10)` |
| accent wash (hero / next-step panels) | `#eef6ff` | `rgba(148,188,227,.09)` |
| chart series 1–5 | `#5980a6` `#749dc4` `#94bce3` `#c79aa1` `#d6ebff` | `#94bce3` `#6d94ba` `#4f7396` `#a8737d` `#2c455d` |
| bar track | `#e7e7ea` | `rgba(233,235,237,.10)` |
| chart gridline (outer / mid) | `#d4d4d7` / `#e7e7ea` | `rgba(233,235,237,.16)` / `.10` |
| area fill under trend line | `#b5d9fd` @ opacity `.38` | `#94bce3` @ opacity `.16` |
| buy marker | `r=4`, fill `#f2f2f3`, stroke `#416180` 1.5 | fill `#15181b`, stroke `#b5d9fd` |

### Colors — dark ground

`--color-bg #15181b` · `--color-surface #1c2126` · `--color-text #e9ebed` ·
`--color-divider rgba(233,235,237,.16)` · `--color-accent #94bce3` ·
accent-for-text `#b5d9fd`. Primary button on dark: fill `#94bce3`, text `#15181b`.

Dark is a **token swap only** — no layout, spacing, or size changes anywhere. Apply on
`html.dark`, which is what the existing `ThemeProvider` already toggles.

### Typography

| Role | Family | Size / weight / spacing |
| --- | --- | --- |
| Page title (h2) | Barlow Condensed 600 | 26–36px, `line-height 1.12`, `letter-spacing -0.015em` |
| Section title (h3) | Barlow Condensed 600 | 18–19px, `letter-spacing .03em`, UPPERCASE |
| Hero metric | Barlow Condensed 600 | 40–46px, `letter-spacing -0.02em`, tabular |
| Secondary metric | Barlow Condensed 600 | 27–30px, tabular |
| Tertiary metric (strip) | Barlow Condensed 600 | 19px, tabular |
| Card / row title | Barlow Condensed 600 | 17–22px |
| Metric eyebrow | Barlow 400 | 10px, `letter-spacing .14em`, UPPERCASE, text @ 60% |
| Body | Barlow 400 | 15px / 1.55 |
| Table cell | Barlow 400 | 14px (13.5px on dense/dark tables) |
| Table header | Barlow 400 | 11px, `letter-spacing .08em`, UPPERCASE, text @ 60% |
| Caption / helper | Barlow 400 | 11.5–13px, text @ 50–70% |
| Tag | Barlow 400 | 11px, padding `3px 10px` |

**All money, share counts, percentages, drift values, dates and tickers render in
`ui-monospace, Menlo, monospace` with `font-variant-numeric: tabular-nums`.** Columns must
not jitter between renders. Money format: `R 487 320` — space as thousands separator, no
decimals in headline metrics, 2 decimals in tables and prices. Drift format: `−6.9 pts`.

### Spacing, radius, elevation

Industry's scale is 0.85× density: `--space-1..8` = `3.4 / 6.8 / 10.2 / 13.6 / 20.4 / 27.2px`.
In practice the screens use: page padding `26px`, section gap `22–26px`, card padding
`18–22px`, card inner gap `6–10px`, grid gap `16–22px`, table cell padding `6.8px`.
Radius: **0 everywhere** (`--radius-md 4px` exists but the component layer squares off
cards, buttons, inputs, tags, segmented controls). Shadows: none on cards; `--shadow-sm/md/lg`
reserved for dialogs.

Mobile: min hit target **44px** (48px for the primary CTA), page padding 18px, card gap 14px.

## Screens

Ids below are the mockup's badge ids — search the HTML for `id="3a"` etc.

### 3a / 3b — Overview (the landing page) · light + dark · 1160px
**Purpose:** the ten-second answer — what it's worth, whether it grew, whether the plan
has drifted, and what to do about it.

**Layout, top to bottom:**
1. **Nav** (`.nav`, 14px 26px, 1px bottom divider): brand `HOLDFOLIO` (18px condensed,
   `margin-right:auto`), links Overview / Holdings / Transactions / Plan (13px; active in
   `--color-accent-700`), then a currency segmented control (ZAR / USD / Native), a
   secondary Light-Dark button, and the primary `+ Record a buy`.
2. **Hero metric row** — `grid-template-columns: 1.5fr 1fr 1fr; gap:18px`. Card 1 is
   washed `--color-accent-wash` and carries the 42px total; cards 2 and 3 are plain framed
   cards with 30px values. All three are `.blueprint` with corner marks.
3. **Quiet metric strip** — `grid-template-columns: repeat(5,1fr); gap:16px`, `padding:16px 0`,
   1px divider top and bottom, no card frames. Five items: drift ("Off your plan by",
   loss-colored, with a 5px progress bar), cash ready to invest, goal progress %, TFSA
   contributions with `R 24 000 / 36 000`, best/worst pair. Values 19px.
4. **Two charts side by side** — `1fr 1fr`, each in a `.blueprint` panel padded `20px 22px 14px`.
   - *Value over time*: SVG `viewBox 0 0 780 186`, rendered 160px tall,
     `preserveAspectRatio="none"`. Three gridlines (y=0.5, 93, 185.5). Area polyline
     (accent-300 @ .38) under a 1.75px accent line with `vector-effect="non-scaling-stroke"`.
     Range tabs `1M / 3M / 6M / 1Y / ALL` in a `.seg`, active = accent fill; x-axis labels
     in an evenly-spread flex row, 11px, 55% opacity.
   - *Drift over time*: same box; the **zero line is drawn solid in `--color-text`** and sits
     at mid-height. Three series: one drifting up (accent), one down (`#a2626c` light /
     `#d9a3ab` dark), one flat dashed `4 4` for "others". Legend = 14×2px swatches.
5. **Three-up footer** — allocation donut + legend · "What to do next" washed panel with the
   primary CTA · dashed "Customise cards" panel listing available cards as tags.

**Donut geometry (used in 2a and 3a):** `viewBox 0 0 180 180`, `<g transform="rotate(-90 90 90)">`,
five `<circle cx=90 cy=90 r=70 fill=none stroke-width=26>`. Circumference 439.8.
`stroke-dasharray="<len> 439.8"` where `len = pct% × 439.8 − 2` (the −2 is the hairline gap),
`stroke-dashoffset="-<cumulative>"`. Actual ring at full opacity; the target ring beside it
at `opacity .55`. Center label = value + `ACTUAL` / `TARGET` in 10px, `letter-spacing .12em`.

### 2b — Holding detail · 1160px
**Purpose:** everything about one instrument.
Breadcrumb → header row (ticker 34px + overweight tag, name/exchange/currency, price 34px
with today's delta, then Set target / Sell / Buy more) → five stat cards
(`repeat(5,1fr)`, 15px padding: shares, avg cost, market value, unrealised P/L, fees paid) →
`1fr 320px` split: price chart (`viewBox 0 0 700 176`, buy markers as `r=4` circles on the
line, same range tabs) beside three stacked panels (cost-vs-value bars, weight vs target
with the target tick, tags) → full-width transactions table.

**Transactions table columns:** Date (110px) · Type (70px, tag: Buy = `.tag-accent`,
Sell = loss tint `#f3dfe1` on `#7a4750`) · Shares, Price, Fees, Total (all right-aligned,
mono; Total 500 weight) · Note · Edit ghost button (60px).

### 1a / 1b / 1c / 1d — holdings-list density options
Four alternatives for the holdings view; pick one and drop the others.
- **1a Ledger** — dense table, 1160px. Columns: Holding (190px, ticker 15px condensed over
  11.5px 55% name) · Shares · Avg cost · Price · Value · P/L · Weight-vs-target bar (150px)
  · Drift (74px). Above it: 44px total value, three 168px stat cards, a Holdings/Allocation/
  Performance segmented control and a "Prices … JSE close" timestamp.
- **1b Calm cards** — 1040px, `repeat(3,1fr)` tiles at 18px padding; washed hero strip with
  sparkline; underweight tile takes the loss tint and an explicit "Add ~R 33 500 to reach
  target" line; last tile is a dashed "+ Add a holding".
- **1c Allocation-first, dark** — 1160px, `1fr 340px`. Drift board of 22px-tall bars
  (`96px 1fr 84px` rows) leads; table follows; sidebar holds the rebalance plan and activity.
- **1d Mobile** — 390px, light + dark. Status bar, 34px total + sparkline in a washed panel,
  full-width 2-up segmented control (44px), holding rows (17px ticker + right-aligned value,
  12.5px sub-line, 8px weight bar), 48px primary CTA, 4-item bottom tab bar (11.5px labels).

### 3c — First run · 1160px
Centered column: "Step 1 of 3" eyebrow, 36px title, 560px-max intro, then three 300px cards
(Type in one holding — washed + primary CTA; Import a CSV; Try demo data), then an 820px
dashed panel with a ghosted dashed chart at 35% opacity explaining what will appear.

### 3d — Sign in · 440px, light + dark
Magic-link. Light = email entry (`.field` label 12px + `.input`, 44px primary
"Email me a link", uppercase OR divider, secondary Google button, 12px privacy line).
Dark = the sent state: "Check your email", a washed panel with a `00:41` resend countdown,
secondary "Use a different email".

### 3e — Record a transaction · 560px, light + dark
Buy/Sell/Deposit segmented control (full width) → instrument field → date + currency →
shares + price → **fee breakdown panel** (brokerage 0.25%, investor protection levy,
securities transfer tax 0.25%, VAT 15% on brokerage, total on a divider, 13.5px rows, an
"Edit rates" ghost button) → washed total panel showing `R 18 959.42` at 28px **and the
weight consequence** (`28.7% → 31.2%`, "takes you further off plan", loss-colored) → note/tag
field → Cancel (flex 1) + Save (flex 2).
The dark twin is the **USD case**: cost in USD, rate used, FX spread 0.35%, broker fees,
"Recorded in ZAR", plus a panel stating both currencies are stored.

### 3f — Plan / target weights · 900px
Rows of `170px 1fr 96px 92px`: name+description · bar with a 2px target tick · editable
percentage input (right-aligned mono) · "now 28.7%" (loss-colored when off). Footer is a
washed panel with the running total at 22px and a Save plan primary — the sum must equal
100.0% (`validateTargetsSumTo100`, 0.01 tolerance).

### 3g — CSV import · 1040px
Filename + row count, Choose-another / Import primary; four stat cards (Ready / Need a look /
New tickers / Date range); column-mapping panel of five `.field`s
(Trade Date→Date, Contract Code→Ticker, Qty→Shares, Avg Price (c)→Price ÷ 100, Costs→Total fees)
with the cents note; preview table where flagged rows take the loss tint and a tag
("Looks like a duplicate", "New ticker · set a target?"). Nothing persists until Import.

### 3h — Settings · 900px
Four `210px 1fr` sections split by dividers: **Appearance** (Light/Dark/Match device
segmented + two 150px live preview swatches) · **Money** (display currency select, rate
source, FX spread 0.35%, currencies-in-use tags + live rate) · **Tax year** (1 Mar – 28 Feb,
TFSA limit R 36 000, contribution progress bar) · **Your data** (export CSV, delete account
in loss color).

## Interactions & behavior

- **Range tabs** (`1M / 3M / 6M / 1Y / ALL`) are the only live control in the mockup: they
  re-scale the series, the y-axis labels and the x tick labels. In production they should
  refetch or re-slice the series; y-axis bounds = `min − 12%` … `max + 12%` of the span,
  three labels (hi / mid / lo).
- **Currency toggle** (ZAR / USD / Native) reformats every displayed amount. Stored values
  never change — the transaction keeps its native price and the rate on the day.
- Nav links, table row clicks (→ holding detail), Edit links, and all CTAs are ordinary
  navigation. Charts have no tooltip in the mockup (see open decisions).
- **States:** hover = accent-ramp tint (`--color-accent-600` pressed on light,
  `--color-accent-400` on dark; outlined/ghost use a `color-mix` accent tint); table rows
  hover at `text @ 4%`; disabled = 45% opacity; focus-visible = 2px accent ring, 2px offset.
  These are all already in `industry-styles.css` — don't restyle per screen.
- **Empty states:** every chart panel degrades to the dashed ghost treatment from 3c.
- **Validation:** targets must total 100.0% (±0.01); shares and price > 0; fees ≥ 0;
  ticker uppercase alphanumeric, JSE base symbol with no `.JO` suffix.
- **Responsive:** ≥1100px as drawn. At tablet the 5-up metric strip wraps to 3+2 and the
  two charts stack. Below 640px use the 1d mobile treatment: single column, cards become
  rows, bottom tab bar, 44px minimum targets.

## State

Per screen: `range` and `hRange` (chart window), `displayCurrency`, `theme`
(light | dark | system — persisted to `user_settings.theme`, as `ThemeProvider` already does),
form drafts for 3e/3f, and for 3g the parsed rows plus per-row include/exclude flags.
Derived, not stored: holding weights, drift, P/L, fee totals, goal and TFSA progress.

## Wiring into Tailwind

`apps/web` uses Tailwind with `darkMode: 'class'` and an empty `theme.extend`. Recommended:
link/import `industry-styles.css` + `tokens.css` in `app/layout.tsx` for the CSS variables,
then map them in `tailwind.config.ts` (`colors: { bg: 'var(--color-bg)', accent: …,
gain: 'var(--color-gain)', loss: 'var(--color-loss)' }`, `borderRadius: { DEFAULT: '0' }`,
`fontFamily: { heading: 'var(--font-heading)', body: 'var(--font-body)', mono: 'var(--font-mono)' }`).
That keeps one source of truth and makes dark mode a variable swap rather than a `dark:`
variant on every element.

## Assets

None. No images, no icon files — every graphic in the mockups is hand-authored inline SVG
(donuts, trend lines, sparklines, bars). For icons use **Lucide at stroke-width 1.5**
(`lucide-react`); the mockups use text where icons would go, so choose sparingly.
Fonts: Barlow + Barlow Condensed, imported by `industry-styles.css` from Google Fonts —
in production self-host or use `next/font`.

## Open decisions for the developer

1. Chart tooltips / crosshair on hover — intended, not designed. Keep them square-cornered
   and hairline-bordered if you add them.
2. Which holdings-list density (1a / 1b / 1c / 1d) ships as the Holdings page.
3. The "Customise cards" panel in 3a is a stub — the per-user chart preference surface is
   not yet designed.
4. Dark twins exist for 3a, 3d, 3e, 1c, 1d. 3c, 3f, 3g, 3h were drawn light only; they
   need no design work, only the token swap.

## Files

- `mockups/Portfolio Screen Options.dc.html` — all screens (needs `mockups/support.js` beside it
  and the design system at `_ds/industry-…/styles.css`; open from the project root for the
  stylesheet path to resolve, or repoint the `<link>` at `industry-styles.css` in this folder).
- `industry-styles.css` — the Industry design system: tokens + component classes. Authoritative.
- `tokens.css` — app-level additions: finance pastels, chart palette, dark overrides, and the
  three repeated primitives (`.num`, `.weight-bar`, metric label/value).

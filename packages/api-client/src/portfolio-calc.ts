/**
 * Pure portfolio calculation logic, shared between web and mobile Overview
 * screens. No I/O here — callers fetch transactions/deposits/targets rows
 * and current prices themselves (their Supabase client setup differs), then
 * pass the raw data in. Extracted from apps/web/app/(app)/page.tsx so the
 * math only has one place to be correct, and to bugfix.
 */

export interface TransactionRow {
  id?: string
  date: string
  ticker: string
  shares: number
  price_at_transaction: number
  account_type?: string | null
  transaction_type?: string | null
  commission_fee?: number | null
  deposit_fee?: number | null
  settlement_admin_fee?: number | null
  ipl_admin_fee?: number | null
  securities_transfer_tax_fee?: number | null
  vat_fee?: number | null
  fx_fee?: number | null
  other_fees?: number | null
}

export interface DepositRow {
  amount: number
  deposit_fee?: number | null
  movement_type?: string | null
}

export interface TargetRow {
  ticker: string
  target_weight_pct: number
}

export interface HoldingCalc {
  ticker: string
  shares: number
  share_value: number
  fees: number
  purchase_value: number
  current_price: number
  current_value: number
  market_profit_loss: number
  market_profit_loss_pct: number
  profit_loss: number
  profit_loss_pct: number
  current_weight_pct: number
  target_weight_pct: number
  drift_pct: number
  account_type: string
  realized_gain: number
}

export interface PortfolioCalcResult {
  holdings: HoldingCalc[]
  totalValue: number
  totalShareInvestment: number
  totalFeesPaid: number
  totalCostBasis: number
  totalMarketProfit: number
  totalMarketProfitPct: number
  totalProfitLoss: number
  totalProfitLossPct: number
  totalDeposits: number
  totalDepositFees: number
  uninvestedCapital: number
  totalRealizedGain: number
}

/** A ticker's position after replaying its transactions in date order. */
export interface TickerPosition {
  shares: number
  /** Cost basis of currently-held shares, buy price only (fees excluded). */
  shareValue: number
  /** Fees embedded in the cost basis of currently-held shares. */
  fees: number
  avgCostPerShare: number
  accountType: string
  /** Sum of realized gain/loss across every sell of this ticker, ever. */
  realizedGain: number
  /** Per-sell-transaction realized gain/loss, keyed by transaction id. */
  realizedGainByTransactionId: Map<string, number>
}

const ACTIVE_SHARE_EPSILON = 1e-6

function transactionFees(tx: TransactionRow): number {
  return (tx.commission_fee || 0) + (tx.deposit_fee || 0) + (tx.settlement_admin_fee || 0)
    + (tx.ipl_admin_fee || 0) + (tx.securities_transfer_tax_fee || 0) + (tx.vat_fee || 0)
    + (tx.fx_fee || 0) + (tx.other_fees || 0)
}

function groupByTicker(transactions: TransactionRow[]): Map<string, TransactionRow[]> {
  const grouped = new Map<string, TransactionRow[]>()
  transactions.forEach((tx) => {
    if (!grouped.has(tx.ticker)) grouped.set(tx.ticker, [])
    grouped.get(tx.ticker)!.push(tx)
  })
  return grouped
}

/**
 * Replays one ticker's transactions in date order to get its current position
 * and realized gains, using an average-cost method: a sell reduces shares and
 * cost basis proportionally to the running average cost per share at the time
 * of that sale — not a specific lot. This matches the "avg cost" figure the
 * app has always shown per holding (total cost / total shares), so a sell's
 * realized gain is always consistent with what the app displays elsewhere,
 * rather than requiring FIFO lot tracking the rest of the app doesn't do.
 *
 * Deliberately not memoized/cached anywhere — realized gain depends on the
 * full history up to each sale, so if an earlier buy is edited or deleted,
 * recomputing from scratch is the only way to avoid a stale number. Same
 * derive-don't-cache principle this file already uses for weight%/drift%/P&L.
 */
export function calculateTickerPosition(transactions: TransactionRow[]): TickerPosition {
  const sorted = [...transactions].sort((a, b) => +new Date(a.date) - +new Date(b.date))

  let shares = 0
  let shareValue = 0
  let fees = 0
  let realizedGain = 0
  let accountType = 'ZAR'
  const realizedGainByTransactionId = new Map<string, number>()

  sorted.forEach((tx) => {
    accountType = tx.account_type || accountType
    const txFees = transactionFees(tx)

    if (tx.transaction_type === 'sell') {
      // Guard against selling more than is on record (bad/out-of-order data) —
      // never let a sell push the position negative.
      const sellShares = Math.min(tx.shares, shares)
      const ratio = shares > 0 ? sellShares / shares : 0
      const shareValueRemoved = shareValue * ratio
      const feesRemoved = fees * ratio
      const costBasisRemoved = shareValueRemoved + feesRemoved
      const proceeds = sellShares * tx.price_at_transaction
      const gain = proceeds - txFees - costBasisRemoved

      realizedGain += gain
      if (tx.id) realizedGainByTransactionId.set(tx.id, gain)

      shares -= sellShares
      shareValue -= shareValueRemoved
      fees -= feesRemoved
    } else {
      const investmentCost = tx.shares * tx.price_at_transaction
      shares += tx.shares
      shareValue += investmentCost
      fees += txFees
    }
  })

  return {
    shares,
    shareValue,
    fees,
    avgCostPerShare: shares > ACTIVE_SHARE_EPSILON ? (shareValue + fees) / shares : 0,
    accountType,
    realizedGain,
    realizedGainByTransactionId,
  }
}

/**
 * Portfolio-wide realized gains, independent of calculatePortfolio() — needs
 * no current prices, since a sale's gain/loss is fully determined by
 * historical transaction data alone. Activity screens use this directly to
 * show a per-sale figure without fetching quotes.
 */
export function calculateRealizedGains(transactions: TransactionRow[]): {
  totalRealizedGain: number
  realizedGainByTransactionId: Map<string, number>
} {
  let totalRealizedGain = 0
  const realizedGainByTransactionId = new Map<string, number>()

  groupByTicker(transactions).forEach((txs) => {
    const position = calculateTickerPosition(txs)
    totalRealizedGain += position.realizedGain
    position.realizedGainByTransactionId.forEach((gain, id) => realizedGainByTransactionId.set(id, gain))
  })

  return { totalRealizedGain, realizedGainByTransactionId }
}

/** Unique tickers with a net-positive share count — the set that needs a current price. */
export function getActiveTickers(transactions: TransactionRow[]): string[] {
  const sharesByTicker = new Map<string, number>()
  transactions.forEach((tx) => {
    const delta = tx.transaction_type === 'sell' ? -tx.shares : tx.shares
    sharesByTicker.set(tx.ticker, (sharesByTicker.get(tx.ticker) || 0) + delta)
  })
  return Array.from(sharesByTicker.entries())
    .filter(([, shares]) => shares > ACTIVE_SHARE_EPSILON)
    .map(([ticker]) => ticker)
}

export function calculatePortfolio(
  transactions: TransactionRow[],
  deposits: DepositRow[],
  targets: TargetRow[],
  prices: Map<string, number>
): PortfolioCalcResult {
  // amount is always positive; movement_type carries direction. Rows without a
  // movement_type (pre-migration data) are treated as deposits, matching the
  // column's DB default.
  const totalDeposited = deposits.reduce(
    (sum, d) => sum + (d.movement_type === 'withdrawal' ? -d.amount : d.amount),
    0
  )
  const totalDepositFees = deposits.reduce((sum, d) => sum + (d.deposit_fee || 0), 0)

  const empty: PortfolioCalcResult = {
    holdings: [], totalValue: 0, totalShareInvestment: 0, totalFeesPaid: 0, totalCostBasis: 0,
    totalMarketProfit: 0, totalMarketProfitPct: 0, totalProfitLoss: 0, totalProfitLossPct: 0,
    totalDeposits: totalDeposited, totalDepositFees, uninvestedCapital: totalDeposited,
    totalRealizedGain: 0,
  }

  if (transactions.length === 0) return empty

  const positionsByTicker = new Map<string, TickerPosition>()
  groupByTicker(transactions).forEach((txs, ticker) => {
    positionsByTicker.set(ticker, calculateTickerPosition(txs))
  })

  // Realized gains count for every ticker ever traded, including ones fully
  // sold out of (shares === 0 today) — those sales still happened.
  let totalRealizedGain = 0
  positionsByTicker.forEach((p) => { totalRealizedGain += p.realizedGain })

  const activeTickers = getActiveTickers(transactions)
  if (activeTickers.length === 0) return { ...empty, totalRealizedGain }

  let portfolioValue = 0
  activeTickers.forEach((ticker) => {
    const position = positionsByTicker.get(ticker)
    const price = prices.get(ticker)
    if (position && price) portfolioValue += position.shares * price
  })

  const targetsByTicker = new Map<string, number>()
  targets.forEach((t) => targetsByTicker.set(t.ticker, t.target_weight_pct))

  const holdings: HoldingCalc[] = activeTickers
    .map((ticker): HoldingCalc | null => {
      const position = positionsByTicker.get(ticker)
      const currentPrice = prices.get(ticker)
      if (!position || !currentPrice) return null

      const { shares, shareValue, fees, realizedGain, accountType } = position
      const purchaseValue = shareValue + fees

      const currentValue = shares * currentPrice
      const marketProfitLoss = currentValue - shareValue
      const marketProfitLossPct = shareValue > 0 ? (marketProfitLoss / shareValue) * 100 : 0
      const totalProfitLoss = currentValue - purchaseValue
      const totalProfitLossPct = purchaseValue > 0 ? (totalProfitLoss / purchaseValue) * 100 : 0
      const currentWeightPct = portfolioValue > 0 ? (currentValue / portfolioValue) * 100 : 0
      const targetWeightPct = targetsByTicker.get(ticker) || 0

      return {
        ticker,
        shares,
        share_value: shareValue,
        fees,
        purchase_value: purchaseValue,
        current_price: currentPrice,
        current_value: currentValue,
        market_profit_loss: marketProfitLoss,
        market_profit_loss_pct: marketProfitLossPct,
        profit_loss: totalProfitLoss,
        profit_loss_pct: totalProfitLossPct,
        current_weight_pct: currentWeightPct,
        target_weight_pct: targetWeightPct,
        drift_pct: currentWeightPct - targetWeightPct,
        account_type: accountType,
        realized_gain: realizedGain,
      }
    })
    .filter((h): h is HoldingCalc => h !== null)
    .sort((a, b) => b.current_value - a.current_value)

  let totalShareInvestment = 0
  let totalFeesPaid = 0
  let totalCostBasis = 0
  let totalMarketProfit = 0
  let totalProfitLoss = 0

  holdings.forEach((h) => {
    totalShareInvestment += h.share_value
    totalFeesPaid += h.fees
    totalCostBasis += h.purchase_value
    totalMarketProfit += h.market_profit_loss
    totalProfitLoss += h.profit_loss
  })

  return {
    holdings,
    totalValue: portfolioValue,
    totalShareInvestment,
    totalFeesPaid,
    totalCostBasis,
    totalMarketProfit,
    totalMarketProfitPct: totalShareInvestment > 0 ? (totalMarketProfit / totalShareInvestment) * 100 : 0,
    totalProfitLoss,
    totalProfitLossPct: totalCostBasis > 0 ? (totalProfitLoss / totalCostBasis) * 100 : 0,
    totalDeposits: totalDeposited,
    totalDepositFees,
    uninvestedCapital: totalDeposited - totalCostBasis,
    totalRealizedGain,
  }
}

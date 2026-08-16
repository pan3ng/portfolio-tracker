/**
 * Pure portfolio calculation logic, shared between web and mobile Overview
 * screens. No I/O here — callers fetch transactions/deposits/targets rows
 * and current prices themselves (their Supabase client setup differs), then
 * pass the raw data in. Extracted from apps/web/app/(app)/page.tsx so the
 * math only has one place to be correct, and to bugfix.
 */

export interface TransactionRow {
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
}

function transactionFees(tx: TransactionRow): number {
  return (tx.commission_fee || 0) + (tx.deposit_fee || 0) + (tx.settlement_admin_fee || 0)
    + (tx.ipl_admin_fee || 0) + (tx.securities_transfer_tax_fee || 0) + (tx.vat_fee || 0)
    + (tx.fx_fee || 0) + (tx.other_fees || 0)
}

/** Unique tickers with a net-positive share count — the set that needs a current price. */
export function getActiveTickers(transactions: TransactionRow[]): string[] {
  const sharesByTicker = new Map<string, number>()
  transactions.forEach((tx) => {
    sharesByTicker.set(tx.ticker, (sharesByTicker.get(tx.ticker) || 0) + tx.shares)
  })
  return Array.from(sharesByTicker.entries())
    .filter(([, shares]) => shares > 0)
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
  }

  if (transactions.length === 0) return empty

  const sharesByTicker = new Map<string, number>()
  const shareValueByTicker = new Map<string, number>()
  const feesByTicker = new Map<string, number>()
  const costBasisByTicker = new Map<string, number>()
  const accountByTicker = new Map<string, string>()

  // Every row here is a buy — transaction_type='sell' isn't produced by any UI yet
  // (see TODO.md's Sell scoping plan). When that lands, this aggregation needs to
  // become chronological (average-cost reduction on sell), not a simple sum.
  transactions.forEach((tx) => {
    sharesByTicker.set(tx.ticker, (sharesByTicker.get(tx.ticker) || 0) + tx.shares)

    const investmentCost = tx.shares * tx.price_at_transaction
    shareValueByTicker.set(tx.ticker, (shareValueByTicker.get(tx.ticker) || 0) + investmentCost)

    const fees = transactionFees(tx)
    feesByTicker.set(tx.ticker, (feesByTicker.get(tx.ticker) || 0) + fees)

    costBasisByTicker.set(tx.ticker, (costBasisByTicker.get(tx.ticker) || 0) + investmentCost + fees)
    accountByTicker.set(tx.ticker, tx.account_type || 'ZAR')
  })

  const activeTickers = getActiveTickers(transactions)
  if (activeTickers.length === 0) return empty

  let portfolioValue = 0
  activeTickers.forEach((ticker) => {
    const shares = sharesByTicker.get(ticker) || 0
    const price = prices.get(ticker)
    if (price) portfolioValue += shares * price
  })

  const targetsByTicker = new Map<string, number>()
  targets.forEach((t) => targetsByTicker.set(t.ticker, t.target_weight_pct))

  const holdings: HoldingCalc[] = activeTickers
    .map((ticker): HoldingCalc | null => {
      const shares = sharesByTicker.get(ticker) || 0
      const currentPrice = prices.get(ticker)
      if (!currentPrice) return null

      const shareValue = shareValueByTicker.get(ticker) || 0
      const fees = feesByTicker.get(ticker) || 0
      const purchaseValue = costBasisByTicker.get(ticker) || 0
      const account = accountByTicker.get(ticker) || 'ZAR'

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
        account_type: account,
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
  }
}

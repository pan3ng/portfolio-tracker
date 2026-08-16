// File: apps/web/app/portfolio/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchQuote, getTickerName, type Transaction, type Target, type Holding } from '@portfolio-tracker/api-client'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { SortableTh, type SortDir } from '@/components/SortableTh'

type AccountFilter = 'all' | 'ZAR' | 'USD'

const HOLDING_SORT_ACCESSORS: Record<string, (h: any) => number | string> = {
  ticker: (h) => h.ticker,
  shares: (h) => h.shares,
  avgCost: (h) => (h.shares > 0 ? h.share_value / h.shares : 0),
  price: (h) => h.current_price,
  value: (h) => h.current_value,
  pl: (h) => h.profit_loss_pct,
  fees: (h) => h.fees,
  marketPl: (h) => h.market_profit_loss,
  totalPl: (h) => h.profit_loss,
  weight: (h) => h.current_weight_pct,
  drift: (h) => h.drift_pct,
}

export default function PortfolioPage() {
  const supabase = createClient()
  const router = useRouter()

  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all')
  const [showDetails, setShowDetails] = useState(false)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'ticker' ? 'asc' : 'desc')
    }
  }
  const [holdings, setHoldings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalValue, setTotalValue] = useState(0)
  const [totalShareInvestment, setTotalShareInvestment] = useState(0) // NEW: Share value only
  const [totalFeesPaid, setTotalFeesPaid] = useState(0) // NEW: Total fees
  const [totalCostBasis, setTotalCostBasis] = useState(0) // Share investment + fees
  const [totalMarketProfit, setTotalMarketProfit] = useState(0) // NEW: Market gain/loss
  const [totalMarketProfitPct, setTotalMarketProfitPct] = useState(0) // NEW
  const [totalProfitLoss, setTotalProfitLoss] = useState(0) // Total return (after fees)
  const [totalProfitLossPct, setTotalProfitLossPct] = useState(0)

  useEffect(() => {
    loadPortfolio()
  }, [accountFilter])

  const loadPortfolio = async () => {
    setLoading(true)
    setError(null)

    try {
      // 1. Fetch all transactions for the current user
      let txQuery = supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })

      if (accountFilter !== 'all') {
        txQuery = txQuery.eq('account_type', accountFilter)
      }

      const { data: transactions, error: txError } = await txQuery

      if (txError) throw txError

      if (!transactions || transactions.length === 0) {
        setHoldings([])
        setLoading(false)
        return
      }

      // 2. Calculate total shares, share value, fees, AND cost basis per ticker from transactions
      const sharesByTicker = new Map<string, number>()
      const shareValueByTicker = new Map<string, number>() // NEW: shares × price only
      const feesByTicker = new Map<string, number>() // NEW: total fees per ticker
      const costBasisByTicker = new Map<string, number>()
      const accountByTicker = new Map<string, string>()

      transactions.forEach((tx: any) => {
        const currentShares = sharesByTicker.get(tx.ticker) || 0
        const currentShareValue = shareValueByTicker.get(tx.ticker) || 0
        const currentFees = feesByTicker.get(tx.ticker) || 0
        const currentCostBasis = costBasisByTicker.get(tx.ticker) || 0

        sharesByTicker.set(tx.ticker, currentShares + tx.shares)
        accountByTicker.set(tx.ticker, tx.account_type || 'ZAR')

        // Share value = shares × price_at_transaction (excluding fees)
        const investmentCost = tx.shares * tx.price_at_transaction
        shareValueByTicker.set(tx.ticker, currentShareValue + investmentCost)

        // Calculate total fees for this transaction
        const commissionFee = tx.commission_fee || 0
        const depositFee = tx.deposit_fee || 0
        const settlementAdminFee = tx.settlement_admin_fee || 0
        const iplAdminFee = tx.ipl_admin_fee || 0
        const securitiesTransferTaxFee = tx.securities_transfer_tax_fee || 0
        const vatFee = tx.vat_fee || 0
        const fxFee = tx.fx_fee || 0
        const otherFees = tx.other_fees || 0
        const totalFees = commissionFee + depositFee + settlementAdminFee + iplAdminFee
          + securitiesTransferTaxFee + vatFee + fxFee + otherFees
        feesByTicker.set(tx.ticker, currentFees + totalFees)

        // Cost basis = shares × price_at_transaction + ALL fees
        const totalCost = investmentCost + totalFees
        costBasisByTicker.set(tx.ticker, currentCostBasis + totalCost)
      })

      // Filter out tickers with zero or negative shares (shouldn't happen with current schema)
      const activeTickers = Array.from(sharesByTicker.entries())
        .filter(([_, shares]) => shares > 0)
        .map(([ticker]) => ticker)

      if (activeTickers.length === 0) {
        setHoldings([])
        setLoading(false)
        return
      }

      // 3. Fetch current prices for all active tickers
      const pricePromises = activeTickers.map(async (ticker) => {
        try {
          const quote = await fetchQuote(supabase, ticker)
          return { ticker, price: quote.price_zar }
        } catch (err) {
          console.error(`Failed to fetch quote for ${ticker}:`, err)
          // Return null for failed quotes - we'll handle this below
          return null
        }
      })

      const priceResults = await Promise.all(pricePromises)
      const prices = new Map<string, number>()
      priceResults.forEach((result) => {
        if (result) {
          prices.set(result.ticker, result.price)
        }
      })

      // 4. Fetch target weights
      let targetQuery = supabase.from('targets').select('*')
      if (accountFilter !== 'all') {
        targetQuery = targetQuery.eq('account_type', accountFilter)
      }
      const { data: targets, error: targetError } = await targetQuery

      if (targetError) throw targetError

      const targetsByTicker = new Map<string, number>()
      if (targets) {
        targets.forEach((target: Target) => {
          targetsByTicker.set(target.ticker, target.target_weight_pct)
        })
      }

      // 5. Calculate total portfolio value
      let portfolioValue = 0
      activeTickers.forEach((ticker) => {
        const shares = sharesByTicker.get(ticker) || 0
        const price = prices.get(ticker)
        if (price) {
          portfolioValue += shares * price
        }
      })

      setTotalValue(portfolioValue)

      // 6. Build holdings array with weights, drift, and profit/loss
      const holdingsData = activeTickers
        .map((ticker) => {
          const shares = sharesByTicker.get(ticker) || 0
          const currentPrice = prices.get(ticker)
          const shareValue = shareValueByTicker.get(ticker) || 0  // NEW
          const fees = feesByTicker.get(ticker) || 0  // NEW
          const purchaseValue = costBasisByTicker.get(ticker) || 0
          const account = accountByTicker.get(ticker) || 'ZAR'

          // Skip tickers where we couldn't fetch a price
          if (!currentPrice) {
            return null
          }

          const currentValue = shares * currentPrice
          const marketProfitLoss = currentValue - shareValue  // NEW: Market movement only
          const marketProfitLossPct = shareValue > 0 ? (marketProfitLoss / shareValue) * 100 : 0  // NEW
          const totalProfitLoss = currentValue - purchaseValue  // Total return (after fees)
          const totalProfitLossPct = purchaseValue > 0 ? (totalProfitLoss / purchaseValue) * 100 : 0
          const currentWeightPct = portfolioValue > 0 ? (currentValue / portfolioValue) * 100 : 0
          const targetWeightPct = targetsByTicker.get(ticker) || 0
          const driftPct = currentWeightPct - targetWeightPct

          return {
            ticker,
            shares,
            share_value: shareValue,  // NEW
            fees: fees,  // NEW
            purchase_value: purchaseValue,  // Total cost (share value + fees)
            current_price: currentPrice,
            current_value: currentValue,
            market_profit_loss: marketProfitLoss,  // NEW
            market_profit_loss_pct: marketProfitLossPct,  // NEW
            profit_loss: totalProfitLoss,  // Renamed conceptually to total_profit_loss
            profit_loss_pct: totalProfitLossPct,
            current_weight_pct: currentWeightPct,
            target_weight_pct: targetWeightPct,
            drift_pct: driftPct,
            account_type: account,
          }
        })
        .filter((h): h is any => h !== null)
        .sort((a, b) => b.current_value - a.current_value) // Sort by value descending

      // Calculate totals: share investment, fees, cost basis, and profit/loss
      let totalShareInvestment = 0  // NEW: Total share value only
      let totalFeesPaid = 0  // NEW: Total fees
      let totalCost = 0  // Total cost basis (shares + fees)
      let totalMarketProfit = 0  // NEW: Market gain/loss only
      let totalProfit = 0  // Total return (after fees)

      holdingsData.forEach((holding) => {
        totalShareInvestment += holding.share_value
        totalFeesPaid += holding.fees
        totalCost += holding.purchase_value
        totalMarketProfit += holding.market_profit_loss
        totalProfit += holding.profit_loss
      })

      setTotalShareInvestment(totalShareInvestment)
      setTotalFeesPaid(totalFeesPaid)
      setTotalCostBasis(totalCost)
      setTotalMarketProfit(totalMarketProfit)
      setTotalMarketProfitPct(totalShareInvestment > 0 ? (totalMarketProfit / totalShareInvestment) * 100 : 0)
      setTotalProfitLoss(totalProfit)
      setTotalProfitLossPct(totalCost > 0 ? (totalProfit / totalCost) * 100 : 0)
      setHoldings(holdingsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><p className="text-muted">Loading portfolio...</p></div>
  }

  if (error) {
    return (
      <div style={{ padding: 'var(--space-8) var(--space-4)' }}>
        <Card style={{ borderColor: 'var(--color-loss)' }}>
          <p style={{ margin: 0, color: 'var(--color-loss)' }}>{error}</p>
        </Card>
      </div>
    )
  }

  if (holdings.length === 0) {
    return (
      <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center' }}>
        <h2>No Holdings Yet</h2>
        <p className="text-muted">Record your first transaction to start tracking your portfolio.</p>
        <Link href="/transactions/new" className="btn btn-primary" style={{ marginTop: 'var(--space-3)' }}>Add Transaction</Link>
      </div>
    )
  }

  const sortedHoldings = sortKey
    ? [...holdings].sort((a, b) => {
        const av = HOLDING_SORT_ACCESSORS[sortKey]!(a)
        const bv = HOLDING_SORT_ACCESSORS[sortKey]!(b)
        const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
        return sortDir === 'asc' ? cmp : -cmp
      })
    : holdings

  const targetedHoldings = holdings.filter((h) => h.target_weight_pct > 0)
  const onTrackCount = targetedHoldings.filter((h) => Math.abs(h.drift_pct) <= 1).length

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: 'var(--space-6) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <p className="text-muted" style={{ margin: 0 }}>Current allocation and rebalancing signals — legacy dense view, see Overview for the summary.</p>

      {/* Portfolio growth [1b] — sparkline needs price history, not built yet */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 26, padding: '22px 24px', background: 'var(--color-accent-wash)' }}>
        <div>
          <div className="metric-label" style={{ color: 'var(--color-accent-700)' }}>You own</div>
          <div className="num metric-value" style={{ fontSize: 38 }}>R{totalValue.toFixed(2)}</div>
          <div className="num" style={{ fontSize: 13, marginTop: 2, color: totalMarketProfit >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
            {totalMarketProfit >= 0 ? '+' : ''}R{totalMarketProfit.toFixed(2)} &nbsp;{totalMarketProfitPct >= 0 ? '+' : ''}{totalMarketProfitPct.toFixed(1)}% since you started
          </div>
        </div>
        <div className="text-muted" style={{ flex: 1, minHeight: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--color-divider)', fontSize: 12 }}>
          Growth chart — needs price history, coming soon
        </div>
        {targetedHoldings.length > 0 && (
          <div style={{ textAlign: 'right', paddingLeft: 22, borderLeft: '1px solid var(--color-divider)', flexShrink: 0 }}>
            <div className="metric-label">On track</div>
            <div style={{ font: '600 30px/1.1 var(--font-heading)', color: 'var(--color-accent-700)' }}>{onTrackCount} of {targetedHoldings.length}</div>
            <div className="text-muted" style={{ fontSize: 12 }}>holdings near target</div>
          </div>
        )}
      </Card>

      {/* Total Portfolio Summary Card */}
      <Card style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--space-4)' }}>
          <div>
            <div className="metric-label">Share Investment</div>
            <div className="num metric-value" style={{ fontSize: 18 }}>R{totalShareInvestment.toFixed(2)}</div>
          </div>
          <div>
            <div className="metric-label">Total Fees Paid</div>
            <div className="num metric-value" style={{ fontSize: 18 }}>R{totalFeesPaid.toFixed(2)}</div>
          </div>
          <div>
            <div className="metric-label">Total Cost</div>
            <div className="num metric-value" style={{ fontSize: 18 }}>R{totalCostBasis.toFixed(2)}</div>
          </div>
          <div>
            <div className="metric-label">Current Value</div>
            <div className="num metric-value" style={{ fontSize: 18 }}>R{totalValue.toFixed(2)}</div>
          </div>
          <div>
            <div className="metric-label">Market Gain/Loss</div>
            <div className="num metric-value" style={{ fontSize: 18, color: totalMarketProfit >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
              {totalMarketProfit >= 0 ? '+' : ''}R{totalMarketProfit.toFixed(2)}
            </div>
            <div className="num" style={{ fontSize: 12, color: totalMarketProfitPct >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
              {totalMarketProfitPct >= 0 ? '+' : ''}{totalMarketProfitPct.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="metric-label">Total Return</div>
            <div className="num metric-value" style={{ fontSize: 18, color: totalProfitLoss >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
              {totalProfitLoss >= 0 ? '+' : ''}R{totalProfitLoss.toFixed(2)}
            </div>
            <div className="num" style={{ fontSize: 12, color: totalProfitLossPct >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
              {totalProfitLossPct >= 0 ? '+' : ''}{totalProfitLossPct.toFixed(2)}%
            </div>
          </div>
        </div>
      </Card>

      {/* Account filter + details toggle, kept snug against the table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="seg">
            <span className={`seg-opt${accountFilter === 'all' ? ' is-active' : ''}`} onClick={() => setAccountFilter('all')}>All</span>
            <span className={`seg-opt${accountFilter === 'ZAR' ? ' is-active' : ''}`} onClick={() => setAccountFilter('ZAR')}>ZAR</span>
            <span className={`seg-opt${accountFilter === 'USD' ? ' is-active' : ''}`} onClick={() => setAccountFilter('USD')}>USD</span>
          </span>
          <button onClick={() => setShowDetails(!showDetails)} className="btn btn-ghost" style={{ marginLeft: 'auto' }}>
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
        </div>

        {/* Holdings Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <SortableTh label="Holding" sortKey="ticker" width={190} active={sortKey === 'ticker'} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Shares" sortKey="shares" align="right" active={sortKey === 'shares'} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Avg cost" sortKey="avgCost" align="right" active={sortKey === 'avgCost'} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Price" sortKey="price" align="right" active={sortKey === 'price'} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Value" sortKey="value" align="right" active={sortKey === 'value'} dir={sortDir} onSort={handleSort} />
                <SortableTh label="P/L" sortKey="pl" align="right" active={sortKey === 'pl'} dir={sortDir} onSort={handleSort} />
                {showDetails && <SortableTh label="Fees" sortKey="fees" align="right" active={sortKey === 'fees'} dir={sortDir} onSort={handleSort} />}
                {showDetails && <SortableTh label="Market P/L" sortKey="marketPl" align="right" active={sortKey === 'marketPl'} dir={sortDir} onSort={handleSort} />}
                {showDetails && <SortableTh label="Total P/L" sortKey="totalPl" align="right" active={sortKey === 'totalPl'} dir={sortDir} onSort={handleSort} />}
                <SortableTh label="Weight vs target" sortKey="weight" width={150} active={sortKey === 'weight'} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Drift" sortKey="drift" align="right" width={74} active={sortKey === 'drift'} dir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.map((holding) => {
                const isUnderweight = holding.drift_pct < -1
                const hasTarget = holding.target_weight_pct > 0
                const isMarketProfitable = holding.market_profit_loss >= 0
                const isTotalProfitable = holding.profit_loss >= 0
                const avgCost = holding.shares > 0 ? holding.share_value / holding.shares : 0
                const name = getTickerName(holding.ticker)
                const detailHref = `/portfolio/${holding.ticker}?account=${holding.account_type}`

                return (
                  <tr key={holding.ticker} onClick={() => router.push(detailHref)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15 }}>{holding.ticker}</div>
                      {name && <div className="text-muted" style={{ fontSize: 11.5 }}>{name}</div>}
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>{holding.shares.toFixed(2)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>R{avgCost.toFixed(2)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>R{holding.current_price.toFixed(2)}</td>
                    <td className="num" style={{ textAlign: 'right', fontWeight: 500 }}>R{holding.current_value.toFixed(2)}</td>
                    <td className="num" style={{ textAlign: 'right', color: isTotalProfitable ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                      {isTotalProfitable ? '+' : ''}{holding.profit_loss_pct.toFixed(1)}%
                    </td>
                    {showDetails && <td className="num" style={{ textAlign: 'right' }}>R{holding.fees.toFixed(2)}</td>}
                    {showDetails && (
                      <td className="num" style={{ textAlign: 'right', color: isMarketProfitable ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                        {isMarketProfitable ? '+' : ''}R{holding.market_profit_loss.toFixed(2)}
                      </td>
                    )}
                    {showDetails && (
                      <td className="num" style={{ textAlign: 'right', color: isTotalProfitable ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                        {isTotalProfitable ? '+' : ''}R{holding.profit_loss.toFixed(2)}
                      </td>
                    )}
                    <td>
                      {hasTarget ? (
                        <>
                          <div className="weight-bar">
                            <div className={`fill${isUnderweight ? ' under' : ''}`} style={{ width: `${Math.min(holding.current_weight_pct, 100)}%` }} />
                            <div className="target" style={{ left: `${Math.min(holding.target_weight_pct, 100)}%` }} />
                          </div>
                          <div className="num text-muted" style={{ fontSize: 11, marginTop: 3 }}>
                            {holding.current_weight_pct.toFixed(1)}% / {holding.target_weight_pct.toFixed(1)}%
                          </div>
                        </>
                      ) : (
                        <Link
                          href={`/targets?ticker=${holding.ticker}&account=${holding.account_type}`}
                          className="btn btn-ghost"
                          style={{ fontSize: 12 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Set target →
                        </Link>
                      )}
                    </td>
                    <td className="num" style={{ textAlign: 'right', opacity: hasTarget ? 1 : 0.5, color: hasTarget && Math.abs(holding.drift_pct) > 1 ? 'var(--color-loss)' : undefined }}>
                      {hasTarget ? `${holding.drift_pct > 0 ? '+' : ''}${holding.drift_pct.toFixed(1)}` : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" disabled title="Coming soon" style={{ opacity: 0.5, cursor: 'not-allowed' }}>Export CSV</button>
        <Link href="/targets" className="btn btn-ghost">Rebalance plan →</Link>
      </div>

      {/* Legend */}
      <Card>
        <h5 style={{ marginBottom: 8 }}>Rebalancing Signals</h5>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="tag tag-accent num">-X% ↑</span>
            <span className="text-muted">Underweight — consider buying</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="tag tag-accent-2 num">±0% ✓</span>
            <span className="text-muted">Balanced — within 1% of target</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="tag tag-outline num" style={{ color: 'var(--color-loss)', borderColor: 'var(--color-loss)' }}>+X% ↓</span>
            <span className="text-muted">Overweight — consider selling or rebalancing</span>
          </div>
        </div>
      </Card>
    </div>
  )
}

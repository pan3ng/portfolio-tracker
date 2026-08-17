// File: apps/web/app/portfolio/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchQuote, getTickerName, calculatePortfolio, getActiveTickers } from '@portfolio-tracker/api-client'
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
  const [refreshing, setRefreshing] = useState(false)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountFilter])

  // Uses the shared calculatePortfolio() (packages/api-client) rather than a
  // hand-rolled aggregation — this page used to have its own copy of this
  // math, which silently fell out of sync with Sell support (it summed every
  // transaction's shares regardless of transaction_type, so a sold position
  // still showed as fully held). One calculation, reused everywhere.
  const loadPortfolio = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      let txQuery = supabase.from('transactions').select('*').order('date', { ascending: false })
      if (accountFilter !== 'all') txQuery = txQuery.eq('account_type', accountFilter)
      const { data: transactions, error: txError } = await txQuery
      if (txError) throw txError

      let targetQuery = supabase.from('targets').select('*')
      if (accountFilter !== 'all') targetQuery = targetQuery.eq('account_type', accountFilter)
      const { data: targets, error: targetError } = await targetQuery
      if (targetError) throw targetError

      const tickers = getActiveTickers(transactions || [])

      const priceResults = await Promise.all(
        tickers.map(async (ticker) => {
          try {
            const quote = await fetchQuote(supabase, ticker)
            return { ticker, price: quote.price_zar }
          } catch (err) {
            console.error(`Failed to fetch quote for ${ticker}:`, err)
            return null
          }
        })
      )
      const prices = new Map<string, number>()
      priceResults.forEach((result) => { if (result) prices.set(result.ticker, result.price) })

      const result = calculatePortfolio(transactions || [], [], targets || [], prices)

      setTotalValue(result.totalValue)
      setTotalShareInvestment(result.totalShareInvestment)
      setTotalFeesPaid(result.totalFeesPaid)
      setTotalCostBasis(result.totalCostBasis)
      setTotalMarketProfit(result.totalMarketProfit)
      setTotalMarketProfitPct(result.totalMarketProfitPct)
      setTotalProfitLoss(result.totalProfitLoss)
      setTotalProfitLossPct(result.totalProfitLossPct)
      setHoldings(result.holdings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio')
    } finally {
      setLoading(false)
      setRefreshing(false)
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
          <button
            onClick={() => loadPortfolio(true)}
            disabled={refreshing}
            className="btn btn-ghost"
            title="Refresh prices"
            aria-label="Refresh prices"
            style={{ marginLeft: 'auto', fontSize: 15, lineHeight: 1, padding: '6px 10px' }}
          >
            <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.8s linear infinite' : undefined }}>↻</span>
          </button>
          <button onClick={() => setShowDetails(!showDetails)} className="btn btn-ghost">
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
                {showDetails && <SortableTh label="Total P/L" tooltip="Profit or loss after all trading fees are deducted" sortKey="totalPl" align="right" active={sortKey === 'totalPl'} dir={sortDir} onSort={handleSort} />}
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

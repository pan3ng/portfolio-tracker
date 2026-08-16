// File: apps/web/app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchQuote, getTickerName } from '@portfolio-tracker/api-client'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { SortableTh, type SortDir } from '@/components/SortableTh'
import LandingPage from '@/components/LandingPage'

const HOLDING_SORT_ACCESSORS: Record<string, (h: any) => number | string> = {
  ticker: (h) => h.ticker,
  shares: (h) => h.shares,
  avgCost: (h) => (h.shares > 0 ? h.share_value / h.shares : 0),
  price: (h) => h.current_price,
  value: (h) => h.current_value,
  pl: (h) => h.profit_loss_pct,
  weight: (h) => h.current_weight_pct,
}

type AccountFilter = 'all' | 'ZAR' | 'USD'

export default function PortfolioLandingPage() {
  const supabase = createClient()
  const router = useRouter()

  // Account filtering
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all')

  // Holdings table sorting
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

  // Portfolio state
  const [holdings, setHoldings] = useState<any[]>([])
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
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
  const [userEmail, setUserEmail] = useState<string>('')
  const [totalDeposits, setTotalDeposits] = useState(0) // Total cash deposited
  const [totalDepositFees, setTotalDepositFees] = useState(0) // Fees charged on deposits (informational, not part of P/L)
  const [uninvestedCapital, setUninvestedCapital] = useState(0) // Cash not yet invested
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    loadPortfolio()
  }, [accountFilter])

  const loadPortfolio = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get user email
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Reachable while logged out — middleware allows '/' through so the landing
        // page can render here (see lib/supabase/middleware.ts). No data to fetch.
        setIsAuthenticated(false)
        setLoading(false)
        return
      }
      setIsAuthenticated(true)
      setUserEmail(user.email || '')

      // 1. Fetch all transactions for the current user
      let query = supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })

      // Apply account filter if not 'all'
      if (accountFilter !== 'all') {
        query = query.eq('account_type', accountFilter)
      }

      const { data: transactions, error: txError } = await query

      if (txError) throw txError

      // Store recent transactions for display (limit to 10)
      setRecentTransactions(transactions?.slice(0, 10) || [])

      // 2. Fetch deposits for uninvested capital calculation
      let depositsQuery = supabase.from('deposits').select('*')

      // Apply account filter if not 'all'
      if (accountFilter !== 'all') {
        depositsQuery = depositsQuery.eq('account_type', accountFilter)
      }

      const { data: deposits, error: depositsError } = await depositsQuery

      if (depositsError) {
        console.error('Error loading deposits:', depositsError)
        // Don't throw error, just set deposits to empty array
      }

      // Calculate total deposits
      const totalDeposited = (deposits || []).reduce((sum, d) => sum + d.amount, 0)
      setTotalDeposits(totalDeposited)
      setTotalDepositFees((deposits || []).reduce((sum, d) => sum + (d.deposit_fee || 0), 0))

      if (!transactions || transactions.length === 0) {
        setHoldings([])
        setTotalValue(0)
        setTotalShareInvestment(0)
        setTotalFeesPaid(0)
        setTotalCostBasis(0)
        setTotalMarketProfit(0)
        setTotalMarketProfitPct(0)
        setTotalProfitLoss(0)
        setTotalProfitLossPct(0)
        // Uninvested capital = all deposits when no transactions
        setUninvestedCapital(totalDeposited)
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
        accountByTicker.set(tx.ticker, tx.account_type || 'ZAR')
      })

      // Filter out tickers with zero or negative shares
      const activeTickers = Array.from(sharesByTicker.entries())
        .filter(([_, shares]) => shares > 0)
        .map(([ticker]) => ticker)

      if (activeTickers.length === 0) {
        setHoldings([])
        setTotalValue(0)
        setTotalShareInvestment(0)
        setTotalFeesPaid(0)
        setTotalCostBasis(0)
        setTotalMarketProfit(0)
        setTotalMarketProfitPct(0)
        setTotalProfitLoss(0)
        setTotalProfitLossPct(0)
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

      // Filter targets by account if not 'all'
      if (accountFilter !== 'all') {
        targetQuery = targetQuery.eq('account_type', accountFilter)
      }

      const { data: targets, error: targetError} = await targetQuery

      if (targetError) throw targetError

      const targetsByTicker = new Map<string, number>()
      if (targets) {
        targets.forEach((target: any) => {
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
        .sort((a, b) => b.current_value - a.current_value)

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

      // Calculate uninvested capital: Total Deposits - Total Cost (shares + fees)
      const uninvested = totalDeposited - totalCost
      setUninvestedCapital(uninvested)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio')
    } finally {
      setLoading(false)
    }
  }

  if (isAuthenticated === false) {
    return <LandingPage />
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

  if (holdings.length === 0 && recentTransactions.length === 0) {
    return (
      <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center' }}>
        <h2>Welcome to Portfolio Tracker</h2>
        <p className="text-muted">{userEmail && `Signed in as ${userEmail}`}</p>
        <p className="text-muted" style={{ marginTop: 'var(--space-3)' }}>Get started by recording your first transaction.</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          <Link href="/transactions/new" className="btn btn-primary">Add Transaction</Link>
          <Link href="/settings" className="btn btn-secondary">Settings</Link>
        </div>
      </div>
    )
  }

  const holdingsWithTarget = holdings.filter((h) => h.target_weight_pct > 0)
  const maxDrift = holdingsWithTarget.length > 0
    ? Math.max(...holdingsWithTarget.map((h) => Math.abs(h.drift_pct)))
    : 0

  const bestHolding = holdings.length > 0
    ? holdings.reduce((a, b) => (b.profit_loss_pct > a.profit_loss_pct ? b : a))
    : null
  const worstHolding = holdings.length > 0
    ? holdings.reduce((a, b) => (b.profit_loss_pct < a.profit_loss_pct ? b : a))
    : null

  const DONUT_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--ink-500)']
  const topHoldings = holdings.slice(0, 5)
  const otherValue = holdings.slice(5).reduce((sum, h) => sum + h.current_value, 0)
  const donutRows = otherValue > 0 ? [...topHoldings, { ticker: 'Other', current_value: otherValue }] : topHoldings
  let cumOffset = 0
  const CIRCUMFERENCE = 439.8
  const donutSegments = donutRows.map((h, i) => {
    const pct = totalValue > 0 ? (h.current_value / totalValue) * 100 : 0
    const length = (pct / 100) * CIRCUMFERENCE
    const seg = { label: h.ticker, pct, color: DONUT_COLORS[i % DONUT_COLORS.length], length, offset: cumOffset }
    cumOffset += length
    return seg
  })

  const sortedHoldings = sortKey
    ? [...holdings].sort((a, b) => {
        const av = HOLDING_SORT_ACCESSORS[sortKey]!(a)
        const bv = HOLDING_SORT_ACCESSORS[sortKey]!(b)
        const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
        return sortDir === 'asc' ? cmp : -cmp
      })
    : holdings

  const underweightHoldings = holdings.filter((h) => h.drift_pct < -1)
  const rebalance = (() => {
    if (uninvestedCapital <= 0 || underweightHoldings.length === 0) return null
    const totalMagnitude = underweightHoldings.reduce((sum, h) => sum + Math.abs(h.drift_pct), 0)
    return underweightHoldings
      .map((h) => ({ ticker: h.ticker, amount: uninvestedCapital * (Math.abs(h.drift_pct) / totalMagnitude) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 2)
  })()

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: 'var(--space-6) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span className="seg">
          <span className={`seg-opt${accountFilter === 'all' ? ' is-active' : ''}`} onClick={() => setAccountFilter('all')}>All Accounts</span>
          <span className={`seg-opt${accountFilter === 'ZAR' ? ' is-active' : ''}`} onClick={() => setAccountFilter('ZAR')}>ZAR</span>
          <span className={`seg-opt${accountFilter === 'USD' ? ' is-active' : ''}`} onClick={() => setAccountFilter('USD')}>USD</span>
        </span>
      </div>

      {/* Hero row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 'var(--space-4)' }}>
        <Card style={{ padding: 'var(--space-4)', background: 'var(--color-accent-wash)' }}>
          <div className="metric-label" style={{ color: 'var(--color-accent-700)' }}>What your investments are worth</div>
          <div className="num metric-value" style={{ fontSize: 42, letterSpacing: '-.02em' }}>
            R{totalValue.toFixed(2)}
          </div>
          <div className="text-muted" style={{ fontSize: 12.5 }}>{holdings.length} holding{holdings.length === 1 ? '' : 's'}</div>
        </Card>
        <Card style={{ padding: 'var(--space-4)' }}>
          <div className="metric-label">Gain since you started</div>
          <div className="num metric-value" style={{ fontSize: 30, color: totalMarketProfit >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
            {totalMarketProfit >= 0 ? '+' : ''}R{totalMarketProfit.toFixed(2)}
          </div>
          <div className="num" style={{ fontSize: 12.5, color: totalMarketProfitPct >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
            {totalMarketProfitPct >= 0 ? '+' : ''}{totalMarketProfitPct.toFixed(2)}%
          </div>
        </Card>
        <Card style={{ padding: 'var(--space-4)' }}>
          <div className="metric-label">Total return after fees</div>
          <div className="num metric-value" style={{ fontSize: 30, color: totalProfitLoss >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
            {totalProfitLoss >= 0 ? '+' : ''}R{totalProfitLoss.toFixed(2)}
          </div>
          <div className="num" style={{ fontSize: 12.5, color: totalProfitLossPct >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
            {totalProfitLossPct >= 0 ? '+' : ''}{totalProfitLossPct.toFixed(2)}%
          </div>
          {(totalFeesPaid > 0 || totalDepositFees > 0) && (
            <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
              Investing: R{totalFeesPaid.toFixed(2)} · Deposits: R{totalDepositFees.toFixed(2)}
            </div>
          )}
        </Card>
      </div>

      {/* Metrics strip — no card frames per spec, "quiet" row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-4)', padding: 'var(--space-4) 0', borderTop: '1px solid var(--color-divider)', borderBottom: '1px solid var(--color-divider)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div className="metric-label">Off your plan by</div>
          <div className="num metric-value" style={{ fontSize: 19, color: maxDrift > 1 ? 'var(--color-loss)' : undefined }}>
            {maxDrift.toFixed(1)} pts
          </div>
          <div className="weight-bar"><div className={`fill${maxDrift > 1 ? ' under' : ''}`} style={{ width: `${Math.min(maxDrift * 5, 100)}%` }} /></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div className="metric-label">Cash ready to invest</div>
          <div className="num metric-value" style={{ fontSize: 19 }}>R{uninvestedCapital.toFixed(2)}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, opacity: 0.5 }}>
          <div className="metric-label">Goal</div>
          <div style={{ fontSize: 13 }}>Coming soon</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, opacity: 0.5 }}>
          <div className="metric-label">TFSA this tax year</div>
          <div style={{ fontSize: 13 }}>Coming soon</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div className="metric-label">Best / worst</div>
          {bestHolding && worstHolding ? (
            <div className="num metric-value" style={{ fontSize: 14, lineHeight: 1.3 }}>
              <span style={{ color: 'var(--color-gain)' }}>{bestHolding.ticker} {bestHolding.profit_loss_pct >= 0 ? '+' : ''}{bestHolding.profit_loss_pct.toFixed(1)}%</span><br />
              <span style={{ color: 'var(--color-loss)' }}>{worstHolding.ticker} {worstHolding.profit_loss_pct >= 0 ? '+' : ''}{worstHolding.profit_loss_pct.toFixed(1)}%</span>
            </div>
          ) : <div className="text-muted" style={{ fontSize: 13 }}>-</div>}
        </div>
      </div>

      {/* Charts row — coming soon, no price-history data yet */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <Card dashed style={{ minHeight: 160, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <h3 className="text-muted" style={{ margin: 0, fontSize: 14, letterSpacing: '.03em', textTransform: 'uppercase' }}>What it&apos;s worth over time</h3>
          <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>Needs price history — coming soon</p>
        </Card>
        <Card dashed style={{ minHeight: 160, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <h3 className="text-muted" style={{ margin: 0, fontSize: 14, letterSpacing: '.03em', textTransform: 'uppercase' }}>How far off plan, over time</h3>
          <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>Needs price history — coming soon</p>
        </Card>
      </div>

      {/* Allocation, rebalance suggestion, customise (coming soon) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', alignItems: 'start' }}>
        <Card style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, letterSpacing: '.03em', textTransform: 'uppercase' }}>Where the money sits</h3>
          {donutSegments.length > 0 ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <svg viewBox="0 0 180 180" style={{ width: 110, height: 110, flex: 'none' }}>
                <g transform="rotate(-90 90 90)" fill="none" strokeWidth={26}>
                  {donutSegments.map((seg, i) => (
                    <circle key={i} cx={90} cy={90} r={70} stroke={seg.color} strokeDasharray={`${seg.length} ${CIRCUMFERENCE - seg.length}`} strokeDashoffset={-seg.offset} />
                  ))}
                </g>
                <text x={90} y={94} textAnchor="middle" style={{ font: '600 16px var(--font-heading)', fill: 'var(--color-text)' }}>
                  {holdings.length} fund{holdings.length === 1 ? '' : 's'}
                </text>
              </svg>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                {donutSegments.map((seg, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '10px 1fr 42px', gap: 8, alignItems: 'center' }}>
                    <span style={{ width: 10, height: 10, background: seg.color, display: 'inline-block' }} />
                    <span>{seg.label}</span>
                    <span className="num" style={{ textAlign: 'right' }}>{seg.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>No holdings yet</p>}
        </Card>

        <Card style={{ padding: 'var(--space-4)', background: rebalance ? 'var(--color-accent-wash)' : undefined }}>
          <div className="card-kicker" style={{ marginBottom: 6 }}>What to do next</div>
          {rebalance ? (
            <>
              <h4 style={{ margin: '0 0 8px' }}>Put R{uninvestedCapital.toFixed(0)} to work</h4>
              <p style={{ fontSize: 13, margin: 0, opacity: 0.8 }}>
                Buy {rebalance.map((r) => `R${r.amount.toFixed(0)} of ${r.ticker}`).join(' and ')} and you&apos;re closer to plan — nothing to sell.
              </p>
            </>
          ) : uninvestedCapital > 0 ? (
            <>
              <h4 style={{ margin: '0 0 8px' }}>You&apos;re on plan</h4>
              <p style={{ fontSize: 13, margin: 0, opacity: 0.8 }}>R{uninvestedCapital.toFixed(2)} ready to invest whenever you add a holding to buy.</p>
            </>
          ) : (
            <>
              <h4 style={{ margin: '0 0 8px' }}>No cash to deploy yet</h4>
              <p style={{ fontSize: 13, margin: 0, opacity: 0.8 }}>Record a deposit in Settings to track cash ready to invest.</p>
            </>
          )}
        </Card>

        <Card dashed style={{ padding: 'var(--space-4)', opacity: 0.6 }}>
          <div className="metric-label" style={{ marginBottom: 8 }}>Your overview, your way</div>
          <p style={{ fontSize: 13, margin: '0 0 14px' }}>Pick which cards and charts appear here — coming soon.</p>
          <button className="btn btn-secondary btn-block" disabled>Customise cards</button>
        </Card>
      </div>

      {/* Holdings Table */}
      <div style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 12 }}>Holdings</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <SortableTh label="Holding" sortKey="ticker" width={190} active={sortKey === 'ticker'} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Shares" sortKey="shares" align="right" active={sortKey === 'shares'} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Avg cost" sortKey="avgCost" align="right" active={sortKey === 'avgCost'} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Price" sortKey="price" align="right" active={sortKey === 'price'} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Value" sortKey="value" align="right" active={sortKey === 'value'} dir={sortDir} onSort={handleSort} />
                <SortableTh label="P/L" tooltip="Profit or loss after all trading fees are deducted" sortKey="pl" align="right" active={sortKey === 'pl'} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Weight vs target" sortKey="weight" width={150} active={sortKey === 'weight'} dir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.map((holding) => {
                const isUnderweight = holding.drift_pct < -1
                const hasTarget = holding.target_weight_pct > 0
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Transactions */}
      {recentTransactions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Recent Transactions</h2>
            <Link href="/transactions" className="btn btn-ghost">View All →</Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ticker</th>
                  {accountFilter === 'all' && <th>Account</th>}
                  <th style={{ textAlign: 'right' }}>Shares</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Fees</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="mono">{new Date(tx.date).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 600 }}>{tx.ticker}</td>
                    {accountFilter === 'all' && <td><span className="tag tag-neutral">{tx.account_type || 'ZAR'}</span></td>}
                    <td className="mono" style={{ textAlign: 'right' }}>{tx.shares.toFixed(6)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>R{(tx.shares * tx.price_at_transaction).toFixed(2)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      R{((tx.commission_fee || 0) + (tx.deposit_fee || 0) + (tx.settlement_admin_fee || 0) + (tx.ipl_admin_fee || 0) + (tx.securities_transfer_tax_fee || 0) + (tx.vat_fee || 0) + (tx.fx_fee || 0) + (tx.other_fees || 0)).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/transactions/${tx.id}/edit`} className="btn btn-ghost">Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

// File: apps/web/app/(app)/portfolio/[ticker]/page.tsx
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fetchQuote, getTickerName } from '@portfolio-tracker/api-client'
import { Card } from '@/components/Card'

type AccountType = 'ZAR' | 'USD'

export default function HoldingDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><p className="text-muted">Loading...</p></div>}>
      <HoldingDetailContent />
    </Suspense>
  )
}

function HoldingDetailContent() {
  const supabase = createClient()
  const params = useParams()
  const searchParams = useSearchParams()
  const ticker = decodeURIComponent(String(params.ticker)).toUpperCase()
  const account: AccountType = searchParams.get('account') === 'USD' ? 'USD' : 'ZAR'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [holding, setHolding] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])

  useEffect(() => {
    loadHolding()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, account])

  const loadHolding = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: accountTx, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('account_type', account)
        .order('date', { ascending: false })

      if (txError) throw txError

      const all = accountTx || []
      const tickerTx = all.filter((tx: any) => tx.ticker === ticker)

      if (tickerTx.length === 0) {
        setHolding(null)
        setTransactions([])
        setLoading(false)
        return
      }

      // Shares + value per ticker across the whole account, to get this
      // holding's weight relative to everything else held in it.
      const sharesByTicker = new Map<string, number>()
      const shareValueByTicker = new Map<string, number>()
      const feesByTicker = new Map<string, number>()
      const costBasisByTicker = new Map<string, number>()

      all.forEach((tx: any) => {
        const shares = sharesByTicker.get(tx.ticker) || 0
        const shareValue = shareValueByTicker.get(tx.ticker) || 0
        const fees = feesByTicker.get(tx.ticker) || 0
        const costBasis = costBasisByTicker.get(tx.ticker) || 0

        sharesByTicker.set(tx.ticker, shares + tx.shares)
        const investmentCost = tx.shares * tx.price_at_transaction
        shareValueByTicker.set(tx.ticker, shareValue + investmentCost)
        const totalFees = (tx.commission_fee || 0) + (tx.deposit_fee || 0) + (tx.settlement_admin_fee || 0)
          + (tx.ipl_admin_fee || 0) + (tx.securities_transfer_tax_fee || 0) + (tx.vat_fee || 0) + (tx.fx_fee || 0) + (tx.other_fees || 0)
        feesByTicker.set(tx.ticker, fees + totalFees)
        costBasisByTicker.set(tx.ticker, costBasis + investmentCost + totalFees)
      })

      const activeTickers = Array.from(sharesByTicker.entries()).filter(([, shares]) => shares > 0)
      const thisShares = sharesByTicker.get(ticker) || 0

      if (thisShares <= 0) {
        setHolding(null)
        setTransactions([])
        setLoading(false)
        return
      }

      const priceResults = await Promise.all(
        activeTickers.map(async ([tkr]) => {
          try {
            const quote = await fetchQuote(supabase, tkr)
            return { ticker: tkr, price: quote.price_zar }
          } catch {
            return null
          }
        })
      )
      const prices = new Map<string, number>()
      priceResults.forEach((r) => { if (r) prices.set(r.ticker, r.price) })

      let accountValue = 0
      activeTickers.forEach(([tkr, shares]) => {
        const price = prices.get(tkr)
        if (price) accountValue += shares * price
      })

      const { data: target } = await supabase
        .from('targets')
        .select('*')
        .eq('ticker', ticker)
        .eq('account_type', account)
        .maybeSingle()

      const currentPrice = prices.get(ticker)
      const shareValue = shareValueByTicker.get(ticker) || 0
      const fees = feesByTicker.get(ticker) || 0
      const purchaseValue = costBasisByTicker.get(ticker) || 0
      const currentValue = currentPrice ? thisShares * currentPrice : 0
      const marketProfitLoss = currentValue - shareValue
      const marketProfitLossPct = shareValue > 0 ? (marketProfitLoss / shareValue) * 100 : 0
      const totalProfitLoss = currentValue - purchaseValue
      const totalProfitLossPct = purchaseValue > 0 ? (totalProfitLoss / purchaseValue) * 100 : 0
      const currentWeightPct = accountValue > 0 ? (currentValue / accountValue) * 100 : 0
      const targetWeightPct = target?.target_weight_pct || 0
      const driftPct = currentWeightPct - targetWeightPct

      const tags = Array.from(new Set(tickerTx.flatMap((tx: any) => tx.tags || [])))

      setHolding({
        ticker,
        shares: thisShares,
        avg_cost: thisShares > 0 ? shareValue / thisShares : 0,
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
        drift_pct: driftPct,
        tags,
      })
      setTransactions(tickerTx)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load holding')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><p className="text-muted">Loading holding...</p></div>
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

  if (!holding) {
    return (
      <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center' }}>
        <h2>No {ticker} holding in {account}</h2>
        <p className="text-muted">You don&apos;t currently hold any shares of {ticker} in the {account} account.</p>
        <Link href="/portfolio" className="btn btn-primary" style={{ marginTop: 'var(--space-3)' }}>Back to Holdings</Link>
      </div>
    )
  }

  const hasTarget = holding.target_weight_pct > 0
  const isOverweight = hasTarget && holding.drift_pct > 1
  const isUnderweight = hasTarget && holding.drift_pct < -1
  const name = getTickerName(ticker)
  const maxBar = Math.max(holding.purchase_value, holding.current_value) || 1
  // Account value backed out from this holding's own value/weight, then the
  // Rand amount this holding is off by, for the rebalance suggestion below.
  const accountValueForWeight = holding.current_weight_pct > 0 ? holding.current_value / (holding.current_weight_pct / 100) : 0
  const excessValue = Math.abs(holding.drift_pct) / 100 * accountValueForWeight
  const rebalanceShares = holding.current_price > 0 ? excessValue / holding.current_price : 0

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: 'var(--space-6) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="num text-muted" style={{ fontSize: 12 }}>
        <Link href="/portfolio" style={{ color: 'inherit' }}>Holdings</Link> / <span style={{ color: 'var(--color-accent-700)' }}>{ticker}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 34 }}>{ticker}</h2>
            {hasTarget && (
              <span
                className={`tag num ${isOverweight ? 'tag-outline' : isUnderweight ? 'tag-accent' : 'tag-accent-2'}`}
                style={isOverweight ? { color: 'var(--color-loss)', borderColor: 'var(--color-loss)' } : undefined}
              >
                {isOverweight ? 'Overweight' : isUnderweight ? 'Underweight' : 'On target'} · {holding.drift_pct > 0 ? '+' : ''}{holding.drift_pct.toFixed(1)} pts
              </span>
            )}
          </div>
          <div className="text-muted" style={{ fontSize: 13.5 }}>{name ? `${name} · ` : ''}JSE · {account}</div>
        </div>
        {holding.current_price && (
          <div style={{ textAlign: 'right' }}>
            <div className="num" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 34, lineHeight: 1 }}>R{holding.current_price.toFixed(2)}</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href={`/targets?ticker=${ticker}&account=${account}`} className="btn btn-secondary">Set target</Link>
          <button className="btn btn-secondary" disabled title="Coming soon" style={{ opacity: 0.5, cursor: 'not-allowed' }}>Sell</button>
          <Link href={`/transactions/new?ticker=${ticker}&account=${account}`} className="btn btn-primary">Buy more</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        <Card style={{ padding: 15, gap: 4 }}>
          <div className="metric-label">Shares</div>
          <div className="num metric-value" style={{ fontSize: 22 }}>{holding.shares.toFixed(2)}</div>
        </Card>
        <Card style={{ padding: 15, gap: 4 }}>
          <div className="metric-label">Avg cost</div>
          <div className="num metric-value" style={{ fontSize: 22 }}>R{holding.avg_cost.toFixed(2)}</div>
        </Card>
        <Card style={{ padding: 15, gap: 4 }}>
          <div className="metric-label">Market value</div>
          <div className="num metric-value" style={{ fontSize: 22 }}>R{holding.current_value.toFixed(2)}</div>
        </Card>
        <Card style={{ padding: 15, gap: 4 }}>
          <div className="metric-label">Unrealised P/L</div>
          <div className="num metric-value" style={{ fontSize: 22, color: holding.market_profit_loss >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
            {holding.market_profit_loss >= 0 ? '+' : ''}R{holding.market_profit_loss.toFixed(2)}
          </div>
        </Card>
        <Card style={{ padding: 15, gap: 4 }}>
          <div className="metric-label">Fees paid</div>
          <div className="num metric-value" style={{ fontSize: 22 }}>R{holding.fees.toFixed(2)}</div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 22, alignItems: 'start' }}>
        <Card dashed style={{ padding: '20px 22px 16px', minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <h3 className="text-muted" style={{ margin: 0, fontSize: 15, letterSpacing: '.03em', textTransform: 'uppercase' }}>Price</h3>
          <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>Needs price history — coming soon</p>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Card style={{ padding: '18px 20px' }}>
            <div className="metric-label" style={{ marginBottom: 12 }}>Cost vs value</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                  <span className="text-muted">Cost basis</span><span className="num">R{holding.purchase_value.toFixed(2)}</span>
                </div>
                <div style={{ height: 14, background: 'var(--chart-track)' }}>
                  <div style={{ width: `${(holding.purchase_value / maxBar) * 100}%`, height: '100%', background: 'var(--color-accent-300)' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                  <span className="text-muted">Market value</span><span className="num">R{holding.current_value.toFixed(2)}</span>
                </div>
                <div style={{ height: 14, background: 'var(--chart-track)' }}>
                  <div style={{ width: `${(holding.current_value / maxBar) * 100}%`, height: '100%', background: 'var(--color-accent)' }} />
                </div>
              </div>
              <div className="num" style={{ fontSize: 12.5, color: holding.market_profit_loss >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                {holding.market_profit_loss >= 0 ? 'Growth' : 'Decline'} of {holding.market_profit_loss >= 0 ? '+' : ''}R{holding.market_profit_loss.toFixed(2)} · {holding.market_profit_loss_pct >= 0 ? '+' : ''}{holding.market_profit_loss_pct.toFixed(1)}%
              </div>
            </div>
          </Card>

          <Card style={{ padding: '18px 20px' }}>
            <div className="metric-label" style={{ marginBottom: 10 }}>Weight in portfolio</div>
            {hasTarget ? (
              <>
                <div className="weight-bar" style={{ height: 12 }}>
                  <div className={`fill${isUnderweight ? ' under' : ''}`} style={{ width: `${Math.min(holding.current_weight_pct, 100)}%` }} />
                  <div className="target" style={{ left: `${Math.min(holding.target_weight_pct, 100)}%` }} />
                </div>
                <div className="num text-muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginTop: 5 }}>
                  <span>{holding.current_weight_pct.toFixed(1)}% now</span><span>{holding.target_weight_pct.toFixed(1)}% target</span>
                </div>
                {(isOverweight || isUnderweight) && (
                  <p style={{ fontSize: 12.5, margin: '12px 0 0', opacity: 0.7 }}>
                    {isOverweight
                      ? `Sell ~${rebalanceShares.toFixed(0)} shares — or simply direct your next deposits elsewhere until it drifts back.`
                      : `Add ~R${excessValue.toFixed(0)} to reach target.`}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
                No target set. <Link href={`/targets?ticker=${ticker}&account=${account}`}>Set one →</Link>
              </p>
            )}
          </Card>

          <Card style={{ padding: '18px 20px' }}>
            <div className="metric-label" style={{ marginBottom: 10 }}>Tags</div>
            {holding.tags.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {holding.tags.map((tag: string) => <span key={tag} className="tag tag-accent">{tag}</span>)}
              </div>
            ) : (
              <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>No tags yet — add one from a transaction.</p>
            )}
          </Card>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, letterSpacing: '.03em', textTransform: 'uppercase' }}>Transactions</h3>
          <span className="text-muted" style={{ fontSize: 12 }}>{transactions.length} record{transactions.length === 1 ? '' : 's'} · all in {account}, fees shown separately</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Date</th>
                <th style={{ width: 70 }}>Type</th>
                <th style={{ textAlign: 'right' }}>Shares</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Fees</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Note</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const txFees = (tx.commission_fee || 0) + (tx.deposit_fee || 0) + (tx.settlement_admin_fee || 0)
                  + (tx.ipl_admin_fee || 0) + (tx.securities_transfer_tax_fee || 0) + (tx.vat_fee || 0) + (tx.fx_fee || 0) + (tx.other_fees || 0)
                const total = tx.shares * tx.price_at_transaction
                return (
                  <tr key={tx.id}>
                    <td className="num">{new Date(tx.date).toLocaleDateString()}</td>
                    <td><span className="tag tag-accent">Buy</span></td>
                    <td className="num" style={{ textAlign: 'right' }}>{tx.shares.toFixed(2)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>R{tx.price_at_transaction.toFixed(2)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>R{txFees.toFixed(2)}</td>
                    <td className="num" style={{ textAlign: 'right', fontWeight: 500 }}>R{total.toFixed(2)}</td>
                    <td className="text-muted">{tx.notes || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/transactions/${tx.id}/edit`} className="btn btn-ghost">Edit</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

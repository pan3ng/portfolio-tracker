// File: apps/web/app/transactions/page.tsx
'use client'

import { Fragment, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { calculateRealizedGains } from '@portfolio-tracker/api-client'
import Tag from '@/components/Tag'
import { Card } from '@/components/Card'

type AccountFilter = 'all' | 'ZAR' | 'USD'
type ActivityKind = 'buy' | 'sell' | 'deposit' | 'withdrawal'
type TypeFilter = 'all' | ActivityKind

interface ActivityRow {
  id: string
  kind: ActivityKind
  date: string
  account_type: string
  // buy
  ticker?: string
  shares?: number
  price_at_transaction?: number
  tags?: string[] | null
  notes?: string | null
  commission_fee?: number
  settlement_admin_fee?: number
  ipl_admin_fee?: number
  vat_fee?: number
  securities_transfer_tax_fee?: number
  fx_fee?: number
  other_fees?: number
  // deposit/withdrawal
  amount?: number
  deposit_method?: string
  deposit_fee?: number
  description?: string | null
}

function getTotalFees(row: ActivityRow): number {
  return (row.commission_fee || 0) + (row.settlement_admin_fee || 0) + (row.ipl_admin_fee || 0)
    + (row.securities_transfer_tax_fee || 0) + (row.vat_fee || 0) + (row.fx_fee || 0) + (row.other_fees || 0)
}

export default function TransactionsPage() {
  const supabase = createClient()

  const [rows, setRows] = useState<ActivityRow[]>([])
  const [filteredRows, setFilteredRows] = useState<ActivityRow[]>([])
  const [realizedGainByTxId, setRealizedGainByTxId] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [tickerFilter, setTickerFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadActivity()
  }, [])

  useEffect(() => {
    applyFilters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountFilter, typeFilter, tickerFilter, tagFilter, rows])

  const loadActivity = async () => {
    setLoading(true)
    setError(null)

    try {
      const [{ data: transactions, error: txError }, { data: deposits, error: depError }] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('deposits').select('*').order('date', { ascending: false }),
      ])
      if (txError) throw txError
      if (depError) throw depError

      const txRows: ActivityRow[] = (transactions || []).map((tx: any) => ({
        id: tx.id, kind: tx.transaction_type === 'sell' ? 'sell' : 'buy', date: tx.date, account_type: tx.account_type || 'ZAR',
        ticker: tx.ticker, shares: tx.shares, price_at_transaction: tx.price_at_transaction,
        tags: tx.tags, notes: tx.notes,
        commission_fee: tx.commission_fee, settlement_admin_fee: tx.settlement_admin_fee,
        ipl_admin_fee: tx.ipl_admin_fee, vat_fee: tx.vat_fee,
        securities_transfer_tax_fee: tx.securities_transfer_tax_fee, fx_fee: tx.fx_fee, other_fees: tx.other_fees,
      }))
      const depRows: ActivityRow[] = (deposits || []).map((d: any) => ({
        id: d.id, kind: d.movement_type === 'withdrawal' ? 'withdrawal' : 'deposit', date: d.date,
        account_type: d.account_type, amount: d.amount, deposit_method: d.deposit_method,
        deposit_fee: d.deposit_fee, description: d.description,
      }))

      setRealizedGainByTxId(calculateRealizedGains(transactions || []).realizedGainByTransactionId)
      setRows([...txRows, ...depRows].sort((a, b) => +new Date(b.date) - +new Date(a.date)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...rows]

    if (accountFilter !== 'all') {
      filtered = filtered.filter((r) => r.account_type === accountFilter)
    }
    if (typeFilter !== 'all') {
      filtered = filtered.filter((r) => r.kind === typeFilter)
    }
    if (tickerFilter.trim()) {
      const searchTerm = tickerFilter.trim().toUpperCase()
      filtered = filtered.filter((r) => (r.kind === 'buy' || r.kind === 'sell') && r.ticker?.toUpperCase().includes(searchTerm))
    }
    if (tagFilter.trim()) {
      const searchTag = tagFilter.trim().toLowerCase()
      filtered = filtered.filter((r) => (r.kind === 'buy' || r.kind === 'sell') && r.tags?.some((tag) => tag.toLowerCase().includes(searchTag)))
    }

    setFilteredRows(filtered)
  }

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows)
    newExpanded.has(id) ? newExpanded.delete(id) : newExpanded.add(id)
    setExpandedRows(newExpanded)
  }

  if (loading) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><p className="text-muted">Loading activity...</p></div>
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

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: 'var(--space-6) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/transactions/new" className="btn btn-primary">+ Add Transaction</Link>
      </div>

      {/* Filters */}
      <Card style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
          <div className="field">
            <label htmlFor="typeFilter">Type</label>
            <select id="typeFilter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)} className="input">
              <option value="all">All Types</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="accountFilter">Account</label>
            <select
              id="accountFilter"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value as AccountFilter)}
              className="input"
            >
              <option value="all">All Accounts</option>
              <option value="ZAR">ZAR</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="tickerFilter">Ticker</label>
            <input
              id="tickerFilter" type="text" className="input"
              value={tickerFilter}
              onChange={(e) => setTickerFilter(e.target.value)}
              placeholder="Search by ticker..."
            />
          </div>
          <div className="field">
            <label htmlFor="tagFilter">Tag</label>
            <input
              id="tagFilter" type="text" className="input"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              placeholder="Search by tag..."
            />
          </div>
        </div>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 'var(--space-3)', marginBottom: 0 }}>
          Showing {filteredRows.length} of {rows.length}
        </p>
      </Card>

      {/* Activity Table */}
      {filteredRows.length === 0 ? (
        <Card dashed style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <p className="text-muted">No activity found matching your filters.</p>
          {(accountFilter !== 'all' || typeFilter !== 'all' || tickerFilter || tagFilter) && (
            <button
              onClick={() => { setAccountFilter('all'); setTypeFilter('all'); setTickerFilter(''); setTagFilter('') }}
              className="btn btn-ghost"
              style={{ marginTop: 'var(--space-2)' }}
            >
              Clear filters
            </button>
          )}
        </Card>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Details</th>
                <th>Account</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Fees</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const isExpanded = expandedRows.has(row.id)
                const isTransaction = row.kind === 'buy' || row.kind === 'sell'
                const amount = isTransaction ? (row.shares || 0) * (row.price_at_transaction || 0) : row.amount || 0
                const fees = isTransaction ? getTotalFees(row) : row.deposit_fee || 0
                const editHref = isTransaction ? `/transactions/${row.id}/edit` : `/deposits/${row.id}/edit`
                const typeTagClass = row.kind === 'buy' ? 'tag-accent' : row.kind === 'deposit' ? 'tag-neutral' : 'tag-outline'
                const isLossTinted = row.kind === 'sell' || row.kind === 'withdrawal'
                const realizedGain = row.kind === 'sell' ? realizedGainByTxId.get(row.id) : undefined

                return (
                  <Fragment key={row.id}>
                    <tr>
                      <td className="num">{new Date(row.date).toLocaleDateString()}</td>
                      <td>
                        <span
                          className={`tag ${typeTagClass}`}
                          style={isLossTinted ? { borderColor: 'var(--color-loss)', color: 'var(--color-loss)' } : undefined}
                        >
                          {row.kind === 'buy' ? 'Buy' : row.kind === 'sell' ? 'Sell' : row.kind === 'deposit' ? 'Deposit' : 'Withdrawal'}
                        </span>
                      </td>
                      <td style={{ fontWeight: isTransaction ? 600 : 400 }}>
                        {isTransaction ? row.ticker : (row.description || <span className="text-muted">{(row.deposit_method || 'card').toUpperCase()}</span>)}
                      </td>
                      <td><span className="tag tag-neutral">{row.account_type}</span></td>
                      <td className="num" style={{ textAlign: 'right' }}>R{amount.toFixed(2)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {isTransaction ? (
                          <button onClick={() => toggleRowExpansion(row.id)} className="btn btn-ghost num">
                            R{fees.toFixed(2)}{isExpanded ? ' ▼' : ' ▶'}
                          </button>
                        ) : (
                          `R${fees.toFixed(2)}`
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link href={editHref} className="btn btn-ghost">Edit</Link>
                      </td>
                    </tr>

                    {isExpanded && isTransaction && (
                      <tr>
                        <td colSpan={7} style={{ background: 'var(--color-surface)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-2) 0' }}>
                            {realizedGain !== undefined && (
                              <div>
                                <span className="text-muted">Realized {realizedGain >= 0 ? 'gain' : 'loss'}: </span>
                                <span className="num" style={{ fontWeight: 600, color: realizedGain >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                                  {realizedGain >= 0 ? '+' : ''}R{realizedGain.toFixed(2)}
                                </span>
                              </div>
                            )}
                            <div>
                              <h5 style={{ marginBottom: 8 }}>Fee Breakdown</h5>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', fontSize: 13 }}>
                                <div><span className="text-muted">Commission: </span><span className="num">R{(row.commission_fee || 0).toFixed(2)}</span></div>
                                <div><span className="text-muted">Settlement & admin: </span><span className="num">R{(row.settlement_admin_fee || 0).toFixed(2)}</span></div>
                                <div><span className="text-muted">Investor protection levy: </span><span className="num">R{(row.ipl_admin_fee || 0).toFixed(2)}</span></div>
                                <div><span className="text-muted">VAT: </span><span className="num">R{(row.vat_fee || 0).toFixed(2)}</span></div>
                                {row.kind === 'buy' && (
                                  <div><span className="text-muted">Securities transfer tax: </span><span className="num">R{(row.securities_transfer_tax_fee || 0).toFixed(2)}</span></div>
                                )}
                                <div><span className="text-muted">FX Fee: </span><span className="num">R{(row.fx_fee || 0).toFixed(2)}</span></div>
                                <div><span className="text-muted">Other: </span><span className="num">R{(row.other_fees || 0).toFixed(2)}</span></div>
                              </div>
                            </div>
                            {row.tags && row.tags.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {row.tags.map((tag) => <Tag key={tag} label={tag} variant="primary" />)}
                              </div>
                            )}
                            {row.notes && (
                              <div>
                                <h5 style={{ marginBottom: 4 }}>Notes</h5>
                                <p style={{ margin: 0, fontSize: 13 }}>{row.notes}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

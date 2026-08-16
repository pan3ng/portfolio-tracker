// File: apps/web/app/transactions/page.tsx
'use client'

import { Fragment, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Tag from '@/components/Tag'
import { Card } from '@/components/Card'

type AccountFilter = 'all' | 'ZAR' | 'USD'

export default function TransactionsPage() {
  const supabase = createClient()

  const [transactions, setTransactions] = useState<any[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all')
  const [tickerFilter, setTickerFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadTransactions()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [accountFilter, tickerFilter, tagFilter, transactions])

  const loadTransactions = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })

      if (fetchError) throw fetchError

      setTransactions(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...transactions]

    // Account filter
    if (accountFilter !== 'all') {
      filtered = filtered.filter(tx => (tx.account_type || 'ZAR') === accountFilter)
    }

    // Ticker filter
    if (tickerFilter.trim()) {
      const searchTerm = tickerFilter.trim().toUpperCase()
      filtered = filtered.filter(tx => tx.ticker.toUpperCase().includes(searchTerm))
    }

    // Tag filter
    if (tagFilter.trim()) {
      const searchTag = tagFilter.trim().toLowerCase()
      filtered = filtered.filter(tx =>
        tx.tags && tx.tags.some((tag: string) => tag.toLowerCase().includes(searchTag))
      )
    }

    setFilteredTransactions(filtered)
  }

  const toggleRowExpansion = (txId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(txId)) {
      newExpanded.delete(txId)
    } else {
      newExpanded.add(txId)
    }
    setExpandedRows(newExpanded)
  }

  const getTotalFees = (tx: any) => {
    const commission = tx.commission_fee || 0
    const deposit = tx.deposit_fee || 0
    const settlementAdmin = tx.settlement_admin_fee || 0
    const iplAdmin = tx.ipl_admin_fee || 0
    const securitiesTransferTax = tx.securities_transfer_tax_fee || 0
    const vat = tx.vat_fee || 0
    const fx = tx.fx_fee || 0
    const other = tx.other_fees || 0
    return commission + deposit + settlementAdmin + iplAdmin + securitiesTransferTax + vat + fx + other
  }

  if (loading) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><p className="text-muted">Loading transactions...</p></div>
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
        <Link href="/settings/deposits?new=true" className="btn btn-primary">+ Add Deposit</Link>
      </div>

      {/* Filters */}
      <Card style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
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
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </p>
      </Card>

      {/* Transactions Table */}
      {filteredTransactions.length === 0 ? (
        <Card dashed style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <p className="text-muted">No transactions found matching your filters.</p>
          {(accountFilter !== 'all' || tickerFilter || tagFilter) && (
            <button
              onClick={() => { setAccountFilter('all'); setTickerFilter(''); setTagFilter('') }}
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
                <th>Ticker</th>
                <th>Account</th>
                <th>Tags</th>
                <th style={{ textAlign: 'right' }}>Shares</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Total Fees</th>
                <th style={{ textAlign: 'right' }}>Total Cost</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => {
                const isExpanded = expandedRows.has(tx.id)
                const investmentAmount = tx.shares * tx.price_at_transaction
                const totalFees = getTotalFees(tx)
                const totalCost = investmentAmount + totalFees

                return (
                  <Fragment key={tx.id}>
                    <tr>
                      <td className="num">{new Date(tx.date).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 600 }}>{tx.ticker}</td>
                      <td><span className="tag tag-neutral">{tx.account_type || 'ZAR'}</span></td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {tx.tags && tx.tags.length > 0 ? (
                            tx.tags.map((tag: string) => (
                              <Tag key={tag} label={tag} variant="primary" />
                            ))
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </div>
                      </td>
                      <td className="num" style={{ textAlign: 'right' }}>{tx.shares.toFixed(6)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>R{tx.price_at_transaction.toFixed(2)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>R{investmentAmount.toFixed(2)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        <button onClick={() => toggleRowExpansion(tx.id)} className="btn btn-ghost num">
                          R{totalFees.toFixed(2)}{isExpanded ? ' ▼' : ' ▶'}
                        </button>
                      </td>
                      <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>R{totalCost.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Link href={`/transactions/${tx.id}/edit`} className="btn btn-ghost">Edit</Link>
                      </td>
                    </tr>

                    {/* Expanded Fee Breakdown Row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={10} style={{ background: 'var(--color-surface)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-2) 0' }}>
                            <div>
                              <h5 style={{ marginBottom: 8 }}>Fee Breakdown</h5>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', fontSize: 13 }}>
                                <div><span className="text-muted">Commission: </span><span className="num">R{(tx.commission_fee || 0).toFixed(2)}</span></div>
                                <div><span className="text-muted">Settlement & admin: </span><span className="num">R{(tx.settlement_admin_fee || 0).toFixed(2)}</span></div>
                                <div><span className="text-muted">Investor protection levy: </span><span className="num">R{(tx.ipl_admin_fee || 0).toFixed(2)}</span></div>
                                <div><span className="text-muted">VAT: </span><span className="num">R{(tx.vat_fee || 0).toFixed(2)}</span></div>
                                <div><span className="text-muted">Securities transfer tax: </span><span className="num">R{(tx.securities_transfer_tax_fee || 0).toFixed(2)}</span></div>
                                {(tx.deposit_fee || 0) > 0 && (
                                  <div><span className="text-muted">Deposit ({tx.deposit_method || 'card'}, legacy): </span><span className="num">R{tx.deposit_fee.toFixed(2)}</span></div>
                                )}
                                <div><span className="text-muted">FX Fee: </span><span className="num">R{(tx.fx_fee || 0).toFixed(2)}</span></div>
                                <div><span className="text-muted">Other: </span><span className="num">R{(tx.other_fees || 0).toFixed(2)}</span></div>
                              </div>
                            </div>
                            {tx.notes && (
                              <div>
                                <h5 style={{ marginBottom: 4 }}>Notes</h5>
                                <p style={{ margin: 0, fontSize: 13 }}>{tx.notes}</p>
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

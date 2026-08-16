// File: apps/web/app/transactions/[id]/edit/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchQuote, getTickerName, type Quote } from '@portfolio-tracker/api-client'
import { useRouter, useParams } from 'next/navigation'
import TickerSearch from '@/components/TickerSearch'
import FeeBreakdown, { type FeeBreakdownData } from '@/components/FeeBreakdown'
import TagInput from '@/components/TagInput'
import { Card } from '@/components/Card'

interface UserSettings {
  default_commission_pct: number
  default_fx_pct: number
}

const DEFAULT_SETTINGS: UserSettings = {
  default_commission_pct: 0.25,
  default_fx_pct: 0.5,
}

export default function EditTransactionPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const transactionId = params.id as string

  const [ticker, setTicker] = useState('')
  const [transactionType, setTransactionType] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [accountType, setAccountType] = useState<'ZAR' | 'USD'>('ZAR')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [feeData, setFeeData] = useState<FeeBreakdownData>({
    commissionFee: 0,
    settlementAdminFee: 0,
    iplAdminFee: 0,
    securitiesTransferTaxFee: 0,
    vatFee: 0,
    fxFee: 0,
    otherFees: 0,
    totalFees: 0,
  })
  const [loading, setLoading] = useState(false)
  const [fetchingQuote, setFetchingQuote] = useState(false)
  const [loadingTransaction, setLoadingTransaction] = useState(true)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // User settings
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS)

  // Original transaction data
  const [originalPrice, setOriginalPrice] = useState(0)
  const [originalShares, setOriginalShares] = useState(0)

  useEffect(() => {
    loadUserSettings()
    loadTransaction()
  }, [transactionId])

  const loadUserSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error: fetchError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error loading settings:', fetchError)
      }

      if (data) {
        setUserSettings({
          default_commission_pct: data.default_commission_pct,
          default_fx_pct: data.default_fx_pct,
        })
      }
    } catch (err) {
      console.error('Failed to load user settings:', err)
    } finally {
      setLoadingSettings(false)
    }
  }

  const loadTransaction = async () => {
    setLoadingTransaction(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single()

      if (fetchError) throw fetchError
      if (!data) throw new Error('Transaction not found')

      const storedFees = (data.commission_fee || 0) + (data.settlement_admin_fee || 0) + (data.ipl_admin_fee || 0)
        + (data.securities_transfer_tax_fee || 0) + (data.vat_fee || 0) + (data.fx_fee || 0) + (data.other_fees || 0)

      setTicker(data.ticker)
      setTransactionType(data.transaction_type === 'sell' ? 'sell' : 'buy')
      setOriginalPrice(data.price_at_transaction)
      setOriginalShares(data.shares)
      setAmount((data.shares * data.price_at_transaction).toFixed(2))
      setAccountType(data.account_type || 'ZAR')
      setNotes(data.notes || '')
      setTags(data.tags || [])

      // Set fee data from individual fields (deposit_fee, if any, is legacy —
      // preserved in the DB row untouched but no longer shown/edited here)
      setFeeData({
        commissionFee: data.commission_fee || 0,
        settlementAdminFee: data.settlement_admin_fee || 0,
        iplAdminFee: data.ipl_admin_fee || 0,
        securitiesTransferTaxFee: data.securities_transfer_tax_fee || 0,
        vatFee: data.vat_fee || 0,
        fxFee: data.fx_fee || 0,
        otherFees: data.other_fees || 0,
        totalFees: storedFees,
      })

      // Set the quote to the original price
      setQuote({
        ticker: data.ticker,
        price_zar: data.price_at_transaction,
        fetched_at: data.date,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transaction')
    } finally {
      setLoadingTransaction(false)
    }
  }

  const handleFetchQuote = async () => {
    if (!ticker.trim()) {
      setError('Please enter a ticker')
      return
    }

    setFetchingQuote(true)
    setError(null)

    try {
      const tickerUpper = ticker.trim().toUpperCase()
      const quoteData = await fetchQuote(supabase, tickerUpper)
      setQuote(quoteData)
      setTicker(tickerUpper)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch quote')
      setQuote(null)
    } finally {
      setFetchingQuote(false)
    }
  }

  const calculateShares = () => {
    if (!quote || !amount) return 0
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) return 0
    return amountNum / quote.price_zar
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!quote) {
        throw new Error('Please fetch a quote first')
      }

      const amountNum = parseFloat(amount)

      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Please enter a valid amount')
      }

      const shares = calculateShares()
      if (shares <= 0) {
        throw new Error('Invalid share calculation')
      }

      // Update transaction with fee breakdown
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          ticker: ticker,
          shares: shares,
          price_at_transaction: quote.price_zar,
          account_type: accountType,
          commission_fee: feeData.commissionFee,
          settlement_admin_fee: feeData.settlementAdminFee,
          ipl_admin_fee: feeData.iplAdminFee,
          securities_transfer_tax_fee: feeData.securitiesTransferTaxFee,
          vat_fee: feeData.vatFee,
          fx_fee: feeData.fxFee,
          other_fees: feeData.otherFees,
          total_fees: feeData.totalFees,
          notes: notes.trim() || null,
          tags: tags.length > 0 ? tags : null,
        })
        .eq('id', transactionId)

      if (updateError) throw updateError

      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update transaction')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)

      if (deleteError) throw deleteError

      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transaction')
      setDeleting(false)
    }
  }

  const shares = calculateShares()
  const investmentAmount = parseFloat(amount) || 0
  const currencySymbol = accountType === 'USD' ? '$' : 'R'
  const tickerName = ticker ? getTickerName(ticker) : undefined

  if (loadingTransaction || loadingSettings) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><p className="text-muted">Loading transaction...</p></div>
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>Update transaction details or delete it</p>

      <Card style={{ padding: 'var(--space-6)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="field">
            <label htmlFor="accountType">Account</label>
            <select
              id="accountType" className="input"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as 'ZAR' | 'USD')}
              disabled={loading || deleting}
            >
              <option value="ZAR">ZAR (South African Rand)</option>
              <option value="USD">USD (US Dollar)</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="ticker">Ticker Symbol</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                <TickerSearch
                  value={ticker} onChange={setTicker} disabled={loading || fetchingQuote || deleting}
                  inputStyle={tickerName ? { paddingRight: 150 } : undefined}
                />
                {tickerName && (
                  <span
                    className="text-muted"
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 12, pointerEvents: 'none', overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', maxWidth: 160,
                    }}
                  >
                    {tickerName}
                  </span>
                )}
              </div>
              <button type="button" onClick={handleFetchQuote} disabled={fetchingQuote || loading || deleting} className="btn btn-primary" style={{ flexShrink: 0 }}>
                {fetchingQuote ? 'Fetching...' : 'Get Quote'}
              </button>
            </div>
            {!tickerName && <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Search for a ticker or click &quot;Get Quote&quot; to update the price</p>}
          </div>

          {quote && (
            <Card style={{ borderColor: 'var(--color-accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{quote.ticker}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>Price from {new Date(quote.fetched_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-accent-700)' }}>R{quote.price_zar.toFixed(2)}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>per share</div>
                </div>
              </div>
            </Card>
          )}

          <div className="field">
            <label htmlFor="amount">{transactionType === 'sell' ? 'Amount received' : 'Amount to Invest'} ({accountType})</label>
            <input
              id="amount" type="number" step="0.01" min="0" className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`${currencySymbol} 1000.00`}
              disabled={loading || !quote || deleting}
            />
          </div>

          {quote && amount && shares > 0 && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>{transactionType === 'sell' ? 'Shares sold' : 'Shares to purchase'}</span>
                <span className="num" style={{ fontSize: 18, fontWeight: 600 }}>{shares.toFixed(6)}</span>
              </div>
              <p className="text-muted num" style={{ fontSize: 11, margin: 0 }}>
                {currencySymbol}{amount} ÷ R{quote.price_zar.toFixed(2)} = {shares.toFixed(6)} shares
              </p>
              {shares !== originalShares && (
                <p className="text-muted num" style={{ fontSize: 11, margin: 0 }}>
                  Original: {originalShares.toFixed(6)} shares at R{originalPrice.toFixed(2)}
                </p>
              )}
            </Card>
          )}

          {investmentAmount > 0 && (
            <FeeBreakdown
              investmentAmount={investmentAmount}
              accountType={accountType}
              userSettings={userSettings}
              initialFees={feeData}
              onChange={setFeeData}
              showExpanded={true}
              transactionType={transactionType}
            />
          )}

          <div className="field">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes" className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g., Monthly contribution, Rebalancing trade, etc."
            />
          </div>

          <TagInput tags={tags} onChange={setTags} placeholder="Add tags to categorize this transaction..." />

          {error && (
            <Card style={{ borderColor: 'var(--color-loss)' }}>
              <p style={{ margin: 0, color: 'var(--color-loss)' }}>{error}</p>
            </Card>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="button" onClick={() => router.push('/')} disabled={loading || deleting} className="btn btn-secondary" style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="button" onClick={handleDelete} disabled={loading || deleting} className="btn" style={{ flex: 1, borderColor: 'var(--color-loss)', color: 'var(--color-loss)' }}>
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
            <button type="submit" disabled={loading || !quote || !amount || deleting} className="btn btn-primary" style={{ flex: 1 }}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}

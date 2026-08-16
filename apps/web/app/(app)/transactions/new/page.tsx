// File: apps/web/app/transactions/new/page.tsx
'use client'

import { Suspense, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchQuote, getTickerName, type Quote } from '@portfolio-tracker/api-client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
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

export default function NewTransactionPage() {
  return (
    <Suspense fallback={<div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><p className="text-muted">Loading...</p></div>}>
      <NewTransactionPageContent />
    </Suspense>
  )
}

function NewTransactionPageContent() {
  const router = useRouter()
  const supabase = createClient()
  const searchParams = useSearchParams()

  // Form state
  const [accountType, setAccountType] = useState<'ZAR' | 'USD'>(searchParams.get('account') === 'USD' ? 'USD' : 'ZAR')
  const [ticker, setTicker] = useState(searchParams.get('ticker')?.toUpperCase() || '')
  const [amount, setAmount] = useState('')
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

  // User settings
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS)

  // UI state
  const [loading, setLoading] = useState(false)
  const [fetchingQuote, setFetchingQuote] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load user settings on mount
  useEffect(() => {
    loadUserSettings()
  }, [])

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
      setTicker(tickerUpper) // Update to uppercase
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

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Not authenticated')
      }

      // Insert transaction with fee breakdown
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          ticker: ticker,
          date: new Date().toISOString(),
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
          total_fees: feeData.totalFees, // Kept for backward compatibility
          notes: notes.trim() || null,
          tags: tags.length > 0 ? tags : null,
        })

      if (insertError) throw insertError

      // Success! Redirect to home
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction')
    } finally {
      setLoading(false)
    }
  }

  const shares = calculateShares()
  const investmentAmount = parseFloat(amount) || 0
  const currencySymbol = accountType === 'USD' ? '$' : 'R'

  if (loadingSettings) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><p className="text-muted">Loading...</p></div>
  }

  const today = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
  const tickerName = ticker ? getTickerName(ticker) : undefined
  const totalToPay = investmentAmount + feeData.totalFees

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <Card style={{ padding: 'var(--space-6)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 26 }}>Add a Transaction</h2>
            <span className="text-muted num" style={{ fontSize: 12, marginLeft: 'auto' }}>{accountType} holding</span>
          </div>

          <span className="seg" style={{ width: '100%' }}>
            <span className="seg-opt is-active" style={{ flex: 1, justifyContent: 'center' }}>Buy</span>
            <span
              className="seg-opt" title="Coming soon"
              style={{ flex: 1, justifyContent: 'center', opacity: 0.5, cursor: 'not-allowed' }}
            >
              Sell
            </span>
            <Link
              href="/settings/deposits?new=true"
              className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}
            >
              Deposit
            </Link>
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="field">
              <label>Date</label>
              <div className="input num" style={{ display: 'flex', alignItems: 'center' }}>{today}</div>
            </div>
            <div className="field">
              <label>Currency</label>
              <span className="seg" style={{ width: '100%' }}>
                <span
                  className={`seg-opt${accountType === 'ZAR' ? ' is-active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => !loading && setAccountType('ZAR')}
                >
                  ZAR
                </span>
                <span
                  className={`seg-opt${accountType === 'USD' ? ' is-active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => !loading && setAccountType('USD')}
                >
                  USD
                </span>
              </span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="ticker">What did you buy?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                <TickerSearch
                  value={ticker} onChange={setTicker} disabled={loading || fetchingQuote}
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
              <button type="button" onClick={handleFetchQuote} disabled={fetchingQuote || loading} className="btn btn-primary" style={{ flexShrink: 0 }}>
                {fetchingQuote ? 'Fetching...' : 'Get Quote'}
              </button>
            </div>
            {!tickerName && <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Search and select a ticker, or type it manually</p>}
          </div>

          {quote && (
            <Card style={{ borderColor: 'var(--color-accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span className="num" style={{ fontWeight: 600 }}>{quote.ticker}</span>
                    {tickerName && <span className="text-muted" style={{ fontSize: 12 }}>{tickerName}</span>}
                  </div>
                  <div className="text-muted" style={{ fontSize: 11 }}>Fetched {new Date(quote.fetched_at).toLocaleTimeString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-accent-700)' }}>R{quote.price_zar.toFixed(2)}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>per share</div>
                </div>
              </div>
            </Card>
          )}

          <div className="field">
            <label htmlFor="amount">Amount to invest ({accountType})</label>
            <input
              id="amount" type="number" step="0.01" min="0" className="input num"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`${currencySymbol} 1000.00`}
              disabled={loading || !quote}
            />
            {!quote && <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Please fetch a quote first</p>}
          </div>

          {investmentAmount > 0 && (
            <FeeBreakdown
              investmentAmount={investmentAmount}
              accountType={accountType}
              userSettings={userSettings}
              onChange={setFeeData}
              showExpanded={true}
              hideTotalSummary
            />
          )}

          {quote && amount && shares > 0 && (
            <Card style={{ background: 'var(--color-accent-wash)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <div className="card-kicker">You&apos;ll pay in total</div>
                  <div className="num" style={{ font: '600 28px/1.15 var(--font-heading)' }}>{currencySymbol}{totalToPay.toFixed(2)}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12.5, opacity: 0.75 }}>
                  <div>Shares you&apos;ll receive</div>
                  <div className="num" style={{ fontSize: 15 }}>{shares.toFixed(6)}</div>
                </div>
              </div>
              <p className="text-muted num" style={{ fontSize: 11, margin: '10px 0 0' }}>
                {currencySymbol}{amount} ÷ R{quote.price_zar.toFixed(2)} = {shares.toFixed(6)} shares, plus {currencySymbol}{feeData.totalFees.toFixed(2)} in fees
              </p>
            </Card>
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
            <button type="button" onClick={() => router.push('/')} className="btn btn-secondary" style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" disabled={loading || !quote || !amount} className="btn btn-primary" style={{ flex: 2 }}>
              {loading ? 'Saving...' : 'Save this buy'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}

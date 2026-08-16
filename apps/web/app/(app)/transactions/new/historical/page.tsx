// File: apps/web/app/transactions/new/historical/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchQuote, getTickerName, type Quote } from '@portfolio-tracker/api-client'
import { useRouter } from 'next/navigation'
import TickerSearch from '@/components/TickerSearch'
import DatePicker from '@/components/DatePicker'
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

export default function HistoricalTransactionPage() {
  const router = useRouter()
  const supabase = createClient()

  // Today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0] || new Date().toISOString().substring(0, 10)

  // Form state
  const [accountType, setAccountType] = useState<'ZAR' | 'USD'>('ZAR')
  const [ticker, setTicker] = useState('')
  const [transactionDate, setTransactionDate] = useState<string>(today)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto')
  const [manualPrice, setManualPrice] = useState('')
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
      setTicker(tickerUpper)
      setPriceMode('auto') // Switch to auto mode when quote is fetched
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch quote')
      setQuote(null)
    } finally {
      setFetchingQuote(false)
    }
  }

  const getCurrentPrice = () => {
    if (priceMode === 'manual') {
      const price = parseFloat(manualPrice)
      return isNaN(price) ? 0 : price
    }
    return quote?.price_zar || 0
  }

  const calculateShares = () => {
    const price = getCurrentPrice()
    if (!price || !amount) return 0
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) return 0
    return amountNum / price
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const price = getCurrentPrice()

      if (!ticker.trim()) {
        throw new Error('Please enter a ticker')
      }

      if (!price || price <= 0) {
        throw new Error('Please provide a valid price (fetch quote or enter manually)')
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

      // Insert transaction with custom date and all fee breakdowns
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          ticker: ticker.toUpperCase(),
          shares: shares,
          price_at_transaction: price,
          date: transactionDate, // Custom historical date
          account_type: accountType,
          commission_fee: feeData.commissionFee,
          settlement_admin_fee: feeData.settlementAdminFee,
          ipl_admin_fee: feeData.iplAdminFee,
          securities_transfer_tax_fee: feeData.securitiesTransferTaxFee,
          vat_fee: feeData.vatFee,
          fx_fee: feeData.fxFee,
          other_fees: feeData.otherFees,
          notes: notes.trim() || null,
          tags: tags.length > 0 ? tags : null,
        })

      if (insertError) throw insertError

      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction')
    } finally {
      setLoading(false)
    }
  }

  const shares = calculateShares()
  const currentPrice = getCurrentPrice()
  const investmentAmount = parseFloat(amount) || 0
  const currencySymbol = accountType === 'USD' ? '$' : 'R'
  const tickerName = ticker ? getTickerName(ticker) : undefined

  if (loadingSettings) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><p className="text-muted">Loading settings...</p></div>
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>Enter a historical transaction with a custom date and price</p>

      <Card style={{ padding: 'var(--space-6)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <DatePicker value={transactionDate} onChange={setTransactionDate} label="Transaction Date" maxDate={today} disabled={loading} />

          <div className="field">
            <label htmlFor="accountType">Account</label>
            <select
              id="accountType" className="input"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as 'ZAR' | 'USD')}
              disabled={loading}
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
            {!tickerName && <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Search for a ticker or enter it manually</p>}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 8, color: 'color-mix(in srgb, var(--color-text) 70%, transparent)' }}>Price Source</label>
            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              <label className="radio">
                <input type="radio" value="auto" checked={priceMode === 'auto'} onChange={(e) => setPriceMode(e.target.value as 'auto' | 'manual')} disabled={loading} />
                <span className="dot" />
                Current Market Price
              </label>
              <label className="radio">
                <input type="radio" value="manual" checked={priceMode === 'manual'} onChange={(e) => setPriceMode(e.target.value as 'auto' | 'manual')} disabled={loading} />
                <span className="dot" />
                Manual (Historical) Price
              </label>
            </div>
          </div>

          {priceMode === 'auto' && quote && (
            <Card style={{ borderColor: 'var(--color-accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{quote.ticker}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>Current price from {new Date(quote.fetched_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-accent-700)' }}>R{quote.price_zar.toFixed(2)}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>per share</div>
                </div>
              </div>
            </Card>
          )}

          {priceMode === 'manual' && (
            <div className="field">
              <label htmlFor="manualPrice">Historical Price per Share (ZAR)</label>
              <input
                id="manualPrice" type="number" step="0.01" min="0" className="input"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder="R 100.00"
                disabled={loading}
              />
              <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Enter the price you paid per share at the time of purchase</p>
            </div>
          )}

          <div className="field">
            <label htmlFor="amount">Amount Invested ({accountType})</label>
            <input
              id="amount" type="number" step="0.01" min="0" className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`${currencySymbol} 1000.00`}
              disabled={loading || currentPrice <= 0}
            />
            <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Total amount you invested (excluding fees)</p>
          </div>

          {currentPrice > 0 && amount && shares > 0 && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>Shares purchased</span>
                <span className="num" style={{ fontSize: 18, fontWeight: 600 }}>{shares.toFixed(6)}</span>
              </div>
              <p className="text-muted num" style={{ fontSize: 11, margin: 0 }}>
                {currencySymbol}{amount} ÷ R{currentPrice.toFixed(2)} = {shares.toFixed(6)} shares
              </p>
            </Card>
          )}

          {investmentAmount > 0 && (
            <FeeBreakdown
              investmentAmount={investmentAmount}
              accountType={accountType}
              userSettings={userSettings}
              onChange={setFeeData}
              showExpanded={true}
            />
          )}

          <div className="field">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes" className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g., Historical position from previous broker"
            />
          </div>

          <TagInput tags={tags} onChange={setTags} placeholder="Add tags to categorize this transaction..." />

          {error && (
            <Card style={{ borderColor: 'var(--color-loss)' }}>
              <p style={{ margin: 0, color: 'var(--color-loss)' }}>{error}</p>
            </Card>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="button" onClick={() => router.push('/')} disabled={loading} className="btn btn-secondary" style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" disabled={loading || currentPrice <= 0 || !amount} className="btn btn-primary" style={{ flex: 1 }}>
              {loading ? 'Adding...' : 'Add Historical Transaction'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}

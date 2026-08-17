// File: apps/web/app/transactions/new/page.tsx
'use client'

import { Suspense, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchQuote, getTickerName, calculateTickerPosition, type Quote } from '@portfolio-tracker/api-client'
import { useRouter, useSearchParams } from 'next/navigation'
import TickerSearch from '@/components/TickerSearch'
import DatePicker from '@/components/DatePicker'
import FeeBreakdown, { type FeeBreakdownData } from '@/components/FeeBreakdown'
import TagInput from '@/components/TagInput'
import { Card } from '@/components/Card'

type Kind = 'buy' | 'sell' | 'deposit' | 'withdrawal'
type AccountType = 'ZAR' | 'USD'
type DepositMethod = 'card' | 'eft'

interface HeldPosition {
  ticker: string
  shares: number
  avgCostPerShare: number
  accountType: AccountType
}

interface UserSettings {
  default_commission_pct: number
  default_fx_pct: number
  default_card_deposit_pct: number
  default_eft_deposit_pct: number
}

const DEFAULT_SETTINGS: UserSettings = {
  default_commission_pct: 0.25,
  default_fx_pct: 0.5,
  default_card_deposit_pct: 2.0,
  default_eft_deposit_pct: 0.0,
}

const EMPTY_FEES: FeeBreakdownData = {
  commissionFee: 0, settlementAdminFee: 0, iplAdminFee: 0, securitiesTransferTaxFee: 0,
  vatFee: 0, fxFee: 0, otherFees: 0, totalFees: 0,
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0] as string
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

  const initialKind: Kind = searchParams.get('kind') === 'deposit' ? 'deposit'
    : searchParams.get('kind') === 'withdrawal' ? 'withdrawal'
    : searchParams.get('kind') === 'sell' ? 'sell'
    : 'buy'
  const [kind, setKind] = useState<Kind>(initialKind)
  const [accountType, setAccountType] = useState<AccountType>(searchParams.get('account') === 'USD' ? 'USD' : 'ZAR')

  // Buy/Sell fields
  const [ticker, setTicker] = useState(searchParams.get('ticker')?.toUpperCase() || '')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [feeData, setFeeData] = useState<FeeBreakdownData>(EMPTY_FEES)
  const [isHistorical, setIsHistorical] = useState(false)
  const [transactionDate, setTransactionDate] = useState(todayIso())
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto')
  const [manualPrice, setManualPrice] = useState('')

  // Sell-only fields
  const [heldPositions, setHeldPositions] = useState<HeldPosition[]>([])
  const [loadingPositions, setLoadingPositions] = useState(false)
  const [sellShares, setSellShares] = useState('')

  // Deposit/Withdrawal fields
  const [movementDate, setMovementDate] = useState(todayIso())
  const [movementAmount, setMovementAmount] = useState('')
  const [depositMethod, setDepositMethod] = useState<DepositMethod>('card')
  const [movementFee, setMovementFee] = useState(0)
  const [feeManuallySet, setFeeManuallySet] = useState(false)
  const [description, setDescription] = useState('')

  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(false)
  const [fetchingQuote, setFetchingQuote] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadUserSettings()
  }, [])

  useEffect(() => {
    if (kind === 'sell' && heldPositions.length === 0 && !loadingPositions) {
      loadHeldPositions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  const loadHeldPositions = async () => {
    setLoadingPositions(true)
    try {
      const { data, error: fetchError } = await supabase.from('transactions').select('*')
      if (fetchError) throw fetchError

      const byTicker = new Map<string, typeof data>()
      ;(data || []).forEach((tx: any) => {
        if (!byTicker.has(tx.ticker)) byTicker.set(tx.ticker, [])
        byTicker.get(tx.ticker)!.push(tx)
      })

      const positions: HeldPosition[] = []
      byTicker.forEach((txs, tickerSymbol) => {
        const position = calculateTickerPosition(txs as any)
        if (position.shares > 0.000001) {
          positions.push({
            ticker: tickerSymbol,
            shares: position.shares,
            avgCostPerShare: position.avgCostPerShare,
            accountType: (position.accountType as AccountType) || 'ZAR',
          })
        }
      })
      positions.sort((a, b) => a.ticker.localeCompare(b.ticker))
      setHeldPositions(positions)

      // Arriving from a holding's "Sell" link — preselect it and sync its account.
      const presetTicker = searchParams.get('ticker')?.toUpperCase()
      if (presetTicker) {
        const match = positions.find((p) => p.ticker === presetTicker)
        if (match) setAccountType(match.accountType)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your holdings')
    } finally {
      setLoadingPositions(false)
    }
  }

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
          default_card_deposit_pct: data.default_card_deposit_pct,
          default_eft_deposit_pct: data.default_eft_deposit_pct,
        })
      }
    } catch (err) {
      console.error('Failed to load user settings:', err)
    } finally {
      setLoadingSettings(false)
    }
  }

  // Auto-calculate the movement fee from the chosen deposit method, unless manually set
  useEffect(() => {
    if (kind !== 'deposit' || feeManuallySet) return
    const amountNum = parseFloat(movementAmount) || 0
    const pct = depositMethod === 'card' ? userSettings.default_card_deposit_pct : userSettings.default_eft_deposit_pct
    setMovementFee((amountNum * pct) / 100)
  }, [kind, movementAmount, depositMethod, userSettings, feeManuallySet])

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
      setPriceMode('auto')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch quote')
      setQuote(null)
    } finally {
      setFetchingQuote(false)
    }
  }

  const currentPrice = priceMode === 'manual' ? parseFloat(manualPrice) || 0 : quote?.price_zar || 0

  const calculateShares = () => {
    if (!currentPrice || !amount) return 0
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) return 0
    return amountNum / currentPrice
  }

  const handleSubmitBuy = async () => {
    if (!currentPrice || currentPrice <= 0) {
      throw new Error(priceMode === 'manual' ? 'Please enter a valid price' : 'Please fetch a quote first')
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('Please enter a valid amount')
    }

    const shares = calculateShares()
    if (shares <= 0) {
      throw new Error('Invalid share calculation')
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error: insertError } = await supabase.from('transactions').insert({
      user_id: user.id,
      ticker,
      date: isHistorical ? transactionDate : new Date().toISOString(),
      shares,
      price_at_transaction: currentPrice,
      account_type: accountType,
      transaction_type: 'buy',
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
    if (insertError) throw insertError
  }

  const handleSubmitSell = async () => {
    const heldPosition = heldPositions.find((p) => p.ticker === ticker)
    if (!heldPosition) throw new Error('Select a holding to sell')
    if (!quote) throw new Error('Please fetch a quote first')

    const sharesNum = parseFloat(sellShares)
    if (isNaN(sharesNum) || sharesNum <= 0) throw new Error('Please enter a valid number of shares')
    if (sharesNum > heldPosition.shares) throw new Error(`You only hold ${heldPosition.shares.toFixed(6)} shares`)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error: insertError } = await supabase.from('transactions').insert({
      user_id: user.id,
      ticker,
      date: new Date().toISOString(),
      shares: sharesNum,
      price_at_transaction: quote.price_zar,
      account_type: heldPosition.accountType,
      transaction_type: 'sell',
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
    if (insertError) throw insertError
  }

  const handleSubmitMovement = async () => {
    const amountNum = parseFloat(movementAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('Please enter a valid amount')
    }
    if (!movementDate) {
      throw new Error('Date is required')
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error: insertError } = await supabase.from('deposits').insert({
      user_id: user.id,
      amount: amountNum,
      date: new Date(movementDate).toISOString(),
      account_type: accountType,
      movement_type: kind === 'withdrawal' ? 'withdrawal' : 'deposit',
      deposit_method: depositMethod,
      deposit_fee: movementFee,
      description: description.trim() || null,
    })
    if (insertError) throw insertError
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (kind === 'buy') {
        await handleSubmitBuy()
      } else if (kind === 'sell') {
        await handleSubmitSell()
      } else if (kind === 'deposit' || kind === 'withdrawal') {
        await handleSubmitMovement()
      }
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
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
            <h2 style={{ margin: 0, fontSize: 26 }}>Add Transaction</h2>
            <span className="text-muted num" style={{ fontSize: 12, marginLeft: 'auto' }}>{accountType} account</span>
          </div>

          <span className="seg" style={{ width: '100%' }}>
            <span
              className={`seg-opt${kind === 'buy' ? ' is-active' : ''}`}
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => !loading && setKind('buy')}
            >
              Buy
            </span>
            <span
              className={`seg-opt${kind === 'sell' ? ' is-active' : ''}`}
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => !loading && setKind('sell')}
            >
              Sell
            </span>
            <span
              className={`seg-opt${kind === 'deposit' ? ' is-active' : ''}`}
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => !loading && setKind('deposit')}
            >
              Deposit
            </span>
            <span
              className={`seg-opt${kind === 'withdrawal' ? ' is-active' : ''}`}
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => !loading && setKind('withdrawal')}
            >
              Withdrawal
            </span>
          </span>

          {kind === 'buy' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="field">
                  <label>Date</label>
                  {isHistorical ? (
                    <DatePicker value={transactionDate} onChange={setTransactionDate} label="" maxDate={todayIso()} disabled={loading} />
                  ) : (
                    <div className="input num" style={{ display: 'flex', alignItems: 'center' }}>{today}</div>
                  )}
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

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={isHistorical}
                  onChange={(e) => { setIsHistorical(e.target.checked); if (!e.target.checked) setPriceMode('auto') }}
                  disabled={loading}
                />
                This was a historical purchase (custom date / price)
              </label>

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

              {isHistorical && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 8, color: 'color-mix(in srgb, var(--color-text) 70%, transparent)' }}>Price Source</label>
                  <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                    <label className="radio">
                      <input type="radio" value="auto" checked={priceMode === 'auto'} onChange={() => setPriceMode('auto')} disabled={loading} />
                      <span className="dot" />
                      Current Market Price
                    </label>
                    <label className="radio">
                      <input type="radio" value="manual" checked={priceMode === 'manual'} onChange={() => setPriceMode('manual')} disabled={loading} />
                      <span className="dot" />
                      Manual (Historical) Price
                    </label>
                  </div>
                </div>
              )}

              {priceMode === 'auto' && quote && (
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

              {isHistorical && priceMode === 'manual' && (
                <div className="field">
                  <label htmlFor="manualPrice">Historical Price per Share ({accountType})</label>
                  <input
                    id="manualPrice" type="number" step="0.01" min="0" className="input"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder={`${currencySymbol} 100.00`}
                    disabled={loading}
                  />
                </div>
              )}

              <div className="field">
                <label htmlFor="amount">Amount to invest ({accountType})</label>
                <input
                  id="amount" type="number" step="0.01" min="0" className="input num"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`${currencySymbol} 1000.00`}
                  disabled={loading || !currentPrice}
                />
                {!currentPrice && <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>{isHistorical ? 'Please provide a price above' : 'Please fetch a quote first'}</p>}
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

              {currentPrice > 0 && amount && shares > 0 && (
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
                    {currencySymbol}{amount} ÷ R{currentPrice.toFixed(2)} = {shares.toFixed(6)} shares, plus {currencySymbol}{feeData.totalFees.toFixed(2)} in fees
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
            </>
          )}

          {kind === 'sell' && (() => {
            const heldPosition = heldPositions.find((p) => p.ticker === ticker)
            const sellSharesNum = parseFloat(sellShares) || 0
            const grossProceeds = quote && sellSharesNum > 0 ? sellSharesNum * quote.price_zar : 0
            const netProceeds = grossProceeds - feeData.totalFees
            const costBasisRemoved = heldPosition ? heldPosition.avgCostPerShare * sellSharesNum : 0
            const realizedGain = grossProceeds > 0 ? netProceeds - costBasisRemoved : 0

            return (
              <>
                {loadingPositions ? (
                  <p className="text-muted">Loading your holdings...</p>
                ) : heldPositions.length === 0 ? (
                  <Card dashed>
                    <p className="text-muted" style={{ margin: 0 }}>You don&apos;t hold anything to sell yet.</p>
                  </Card>
                ) : (
                  <>
                    <div className="field">
                      <label htmlFor="sellTicker">Which holding?</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select
                          id="sellTicker" className="input"
                          value={ticker}
                          onChange={(e) => {
                            const selected = heldPositions.find((p) => p.ticker === e.target.value)
                            setTicker(e.target.value)
                            setQuote(null)
                            setSellShares('')
                            if (selected) setAccountType(selected.accountType)
                          }}
                          disabled={loading}
                          style={{ flex: 1 }}
                        >
                          <option value="">Select a ticker...</option>
                          {heldPositions.map((p) => (
                            <option key={p.ticker} value={p.ticker}>
                              {p.ticker} — {p.shares.toFixed(6)} shares ({p.accountType})
                            </option>
                          ))}
                        </select>
                        <button type="button" onClick={handleFetchQuote} disabled={fetchingQuote || loading || !ticker} className="btn btn-primary" style={{ flexShrink: 0 }}>
                          {fetchingQuote ? 'Fetching...' : 'Get Quote'}
                        </button>
                      </div>
                    </div>

                    {heldPosition && (
                      <>
                        {quote && (
                          <Card style={{ borderColor: 'var(--color-accent)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span className="num" style={{ fontWeight: 600 }}>{quote.ticker}</span>
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
                          <label htmlFor="sellShares">Shares to sell (you hold {heldPosition.shares.toFixed(6)})</label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              id="sellShares" type="number" step="0.000001" min="0" max={heldPosition.shares} className="input num"
                              value={sellShares}
                              onChange={(e) => setSellShares(e.target.value)}
                              placeholder="0.000000"
                              disabled={loading || !quote}
                              style={{ flex: 1 }}
                            />
                            <button
                              type="button" className="btn btn-secondary"
                              onClick={() => setSellShares(heldPosition.shares.toString())}
                              disabled={loading || !quote}
                            >
                              Sell all
                            </button>
                          </div>
                          {!quote && <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Please fetch a quote first</p>}
                        </div>

                        {grossProceeds > 0 && (
                          <FeeBreakdown
                            investmentAmount={grossProceeds}
                            accountType={accountType}
                            userSettings={userSettings}
                            onChange={setFeeData}
                            showExpanded={true}
                            hideTotalSummary
                            transactionType="sell"
                          />
                        )}

                        {grossProceeds > 0 && (
                          <Card style={{ background: 'var(--color-accent-wash)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <div>
                                <div className="card-kicker">You&apos;ll receive</div>
                                <div className="num" style={{ font: '600 28px/1.15 var(--font-heading)' }}>{currencySymbol}{netProceeds.toFixed(2)}</div>
                              </div>
                              <div style={{ textAlign: 'right', fontSize: 12.5 }}>
                                <div className="text-muted">Realized {realizedGain >= 0 ? 'gain' : 'loss'}</div>
                                <div className="num" style={{ fontSize: 15, fontWeight: 600, color: realizedGain >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                                  {realizedGain >= 0 ? '+' : ''}{currencySymbol}{realizedGain.toFixed(2)}
                                </div>
                              </div>
                            </div>
                            <p className="text-muted num" style={{ fontSize: 11, margin: '10px 0 0' }}>
                              {sellSharesNum.toFixed(6)} shares × R{quote?.price_zar.toFixed(2)} = {currencySymbol}{grossProceeds.toFixed(2)}, minus {currencySymbol}{feeData.totalFees.toFixed(2)} in fees
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
                            placeholder="e.g., Rebalancing, taking profit, etc."
                          />
                        </div>

                        <TagInput tags={tags} onChange={setTags} placeholder="Add tags to categorize this transaction..." />
                      </>
                    )}
                  </>
                )}
              </>
            )
          })()}

          {(kind === 'deposit' || kind === 'withdrawal') && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="field">
                  <label htmlFor="movementAmount">Amount ({accountType})</label>
                  <input
                    id="movementAmount" type="number" step="0.01" min="0.01" className="input"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                    placeholder={`${currencySymbol} 1000.00`}
                    disabled={loading}
                  />
                </div>
                <DatePicker value={movementDate} onChange={setMovementDate} label="Date" maxDate={todayIso()} disabled={loading} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="field">
                  <label>Account</label>
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
                {kind === 'deposit' && (
                  <div className="field">
                    <label htmlFor="depositMethod">Deposit Method</label>
                    <select
                      id="depositMethod" className="input"
                      value={depositMethod}
                      onChange={(e) => { setDepositMethod(e.target.value as DepositMethod); setFeeManuallySet(false) }}
                      disabled={loading}
                    >
                      <option value="card">Card</option>
                      <option value="eft">EFT</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="field">
                <label htmlFor="movementFee">
                  {kind === 'deposit' ? 'Deposit fee' : 'Withdrawal fee'} ({accountType})
                </label>
                <input
                  id="movementFee" type="number" step="0.01" min="0" className="input"
                  value={movementFee.toFixed(2)}
                  onChange={(e) => { setFeeManuallySet(true); setMovementFee(parseFloat(e.target.value) || 0) }}
                  disabled={loading}
                />
                {kind === 'deposit' && (
                  <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Auto-calculated from your {depositMethod} deposit fee setting — edit to override.
                  </p>
                )}
              </div>

              <div className="field">
                <label htmlFor="description">Description</label>
                <input
                  id="description" type="text" className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={kind === 'deposit' ? 'e.g., Monthly transfer' : 'e.g., Cash needed elsewhere'}
                  disabled={loading}
                />
              </div>
            </>
          )}

          {error && (
            <Card style={{ borderColor: 'var(--color-loss)' }}>
              <p style={{ margin: 0, color: 'var(--color-loss)' }}>{error}</p>
            </Card>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="button" onClick={() => router.push('/')} className="btn btn-secondary" style={{ flex: 1 }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading
                || (kind === 'buy' && (!currentPrice || !amount))
                || (kind === 'sell' && (!quote || !sellShares))
                || ((kind === 'deposit' || kind === 'withdrawal') && !movementAmount)
              }
              className="btn btn-primary" style={{ flex: 2 }}
            >
              {loading ? 'Saving...' : kind === 'buy' ? 'Save this buy' : kind === 'sell' ? 'Save this sale' : kind === 'deposit' ? 'Save deposit' : 'Save withdrawal'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}

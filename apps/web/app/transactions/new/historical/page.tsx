// File: apps/web/app/transactions/new/historical/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchQuote, type Quote } from '@portfolio-tracker/api-client'
import { useRouter } from 'next/navigation'
import TickerSearch from '@/components/TickerSearch'
import DatePicker from '@/components/DatePicker'
import FeeBreakdown, { type FeeBreakdownData } from '@/components/FeeBreakdown'

interface UserSettings {
  default_commission_pct: number
  default_card_deposit_pct: number
  default_eft_deposit_pct: number
  default_fx_pct: number
}

const DEFAULT_SETTINGS: UserSettings = {
  default_commission_pct: 0.25,
  default_card_deposit_pct: 2.0,
  default_eft_deposit_pct: 0.0,
  default_fx_pct: 0.5,
}

export default function HistoricalTransactionPage() {
  const router = useRouter()
  const supabase = createClient()

  // Today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]

  // Form state
  const [accountType, setAccountType] = useState<'ZAR' | 'USD'>('ZAR')
  const [ticker, setTicker] = useState('')
  const [depositMethod, setDepositMethod] = useState<'card' | 'eft'>('card')
  const [transactionDate, setTransactionDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto')
  const [manualPrice, setManualPrice] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [feeData, setFeeData] = useState<FeeBreakdownData>({
    commissionFee: 0,
    depositFee: 0,
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
          default_card_deposit_pct: data.default_card_deposit_pct,
          default_eft_deposit_pct: data.default_eft_deposit_pct,
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
          deposit_method: depositMethod,
          commission_fee: feeData.commissionFee,
          deposit_fee: feeData.depositFee,
          fx_fee: feeData.fxFee,
          other_fees: feeData.otherFees,
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

  if (loadingSettings) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading settings...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Add Historical Position</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter a historical transaction with a custom date and price
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Transaction Date */}
            <DatePicker
              value={transactionDate}
              onChange={setTransactionDate}
              label="Transaction Date"
              maxDate={today}
              disabled={loading}
            />

            {/* Account Type Selector */}
            <div>
              <label htmlFor="accountType" className="block text-sm font-medium text-gray-700">
                Account
              </label>
              <select
                id="accountType"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as 'ZAR' | 'USD')}
                disabled={loading}
                className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              >
                <option value="ZAR">ZAR (South African Rand)</option>
                <option value="USD">USD (US Dollar)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Select which account this investment belongs to
              </p>
            </div>

            {/* Ticker Input */}
            <div>
              <label htmlFor="ticker" className="block text-sm font-medium text-gray-700">
                Ticker Symbol
              </label>
              <div className="mt-1 flex gap-2">
                <TickerSearch
                  value={ticker}
                  onChange={setTicker}
                  disabled={loading || fetchingQuote}
                />
                <button
                  type="button"
                  onClick={handleFetchQuote}
                  disabled={fetchingQuote || loading}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {fetchingQuote ? 'Fetching...' : 'Get Quote'}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Search for a ticker or enter it manually
              </p>
            </div>

            {/* Price Mode Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price Source
              </label>
              <div className="flex gap-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="auto"
                    checked={priceMode === 'auto'}
                    onChange={(e) => setPriceMode(e.target.value as 'auto' | 'manual')}
                    disabled={loading}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Current Market Price</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="manual"
                    checked={priceMode === 'manual'}
                    onChange={(e) => setPriceMode(e.target.value as 'auto' | 'manual')}
                    disabled={loading}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Manual (Historical) Price</span>
                </label>
              </div>
            </div>

            {/* Quote Display (Auto Mode) */}
            {priceMode === 'auto' && quote && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-green-900">{quote.ticker}</p>
                    <p className="text-xs text-green-700">
                      Current price from {new Date(quote.fetched_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-900">
                      R{quote.price_zar.toFixed(2)}
                    </p>
                    <p className="text-xs text-green-700">per share</p>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Price Input (Manual Mode) */}
            {priceMode === 'manual' && (
              <div>
                <label htmlFor="manualPrice" className="block text-sm font-medium text-gray-700">
                  Historical Price per Share (ZAR)
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">R</span>
                  </div>
                  <input
                    id="manualPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="100.00"
                    className="pl-7 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Enter the price you paid per share at the time of purchase
                </p>
              </div>
            )}

            {/* Amount Input */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                Amount Invested (ZAR)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">R</span>
                </div>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1000.00"
                  className="pl-7 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={loading || currentPrice <= 0}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Total amount you invested (excluding fees)
              </p>
            </div>

            {/* Calculated Shares Display */}
            {currentPrice > 0 && amount && shares > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-900">
                    Shares purchased:
                  </span>
                  <span className="text-lg font-bold text-blue-900">
                    {shares.toFixed(6)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-blue-700">
                  R{amount} ÷ R{currentPrice.toFixed(2)} = {shares.toFixed(6)} shares
                </p>
              </div>
            )}

            {/* Deposit Method Selector */}
            <div>
              <label htmlFor="depositMethod" className="block text-sm font-medium text-gray-700">
                Deposit Method
              </label>
              <select
                id="depositMethod"
                value={depositMethod}
                onChange={(e) => setDepositMethod(e.target.value as 'card' | 'eft')}
                disabled={loading}
                className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              >
                <option value="card">Card ({userSettings.default_card_deposit_pct}% fee)</option>
                <option value="eft">EFT ({userSettings.default_eft_deposit_pct}% fee)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                How did you deposit funds for this investment?
              </p>
            </div>

            {/* Fee Breakdown Component */}
            {investmentAmount > 0 && (
              <FeeBreakdown
                investmentAmount={investmentAmount}
                depositMethod={depositMethod}
                accountType={accountType}
                userSettings={userSettings}
                onChange={setFeeData}
                showExpanded={true}
              />
            )}

            {/* Error Display */}
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push('/')}
                disabled={loading}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || currentPrice <= 0 || !amount}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Add Historical Transaction'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

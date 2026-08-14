// File: apps/web/app/transactions/new/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchQuote, type Quote } from '@portfolio-tracker/api-client'
import { useRouter } from 'next/navigation'
import TickerSearch from '@/components/TickerSearch'
import FeeBreakdown, { type FeeBreakdownData } from '@/components/FeeBreakdown'
import TagInput from '@/components/TagInput'

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

export default function NewTransactionPage() {
  const router = useRouter()
  const supabase = createClient()

  // Form state
  const [accountType, setAccountType] = useState<'ZAR' | 'USD'>('ZAR')
  const [ticker, setTicker] = useState('')
  const [depositMethod, setDepositMethod] = useState<'card' | 'eft'>('card')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
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
          deposit_method: depositMethod,
          commission_fee: feeData.commissionFee,
          deposit_fee: feeData.depositFee,
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

  if (loadingSettings) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Add Transaction</h1>
          <p className="mt-2 text-sm text-gray-600">
            Record a new investment transaction
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
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
                Search and select a ticker, or type it manually
              </p>
            </div>

            {/* Quote Display */}
            {quote && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-green-900">{quote.ticker}</p>
                    <p className="text-xs text-green-700">
                      Fetched {new Date(quote.fetched_at).toLocaleTimeString()}
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

            {/* Amount Input */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                Amount to Invest ({accountType})
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
                  disabled={loading || !quote}
                />
              </div>
              {!quote && (
                <p className="mt-1 text-xs text-gray-500">
                  Please fetch a quote first
                </p>
              )}
            </div>

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

            {/* Calculated Shares Display */}
            {quote && amount && shares > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-900">
                    Shares to purchase:
                  </span>
                  <span className="text-lg font-bold text-blue-900">
                    {shares.toFixed(6)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-blue-700">
                  R{amount} ÷ R{quote.price_zar.toFixed(2)} = {shares.toFixed(6)} shares
                </p>
              </div>
            )}

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

            {/* Notes Field */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g., Monthly contribution, Rebalancing trade, etc."
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Tags Input */}
            <TagInput
              tags={tags}
              onChange={setTags}
              placeholder="Add tags to categorize this transaction..."
            />

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
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !quote || !amount}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Transaction'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// File: app/transactions/new/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchQuote, type Quote } from '@portfolio-tracker/api-client'
import { useRouter } from 'next/navigation'

export default function NewTransactionPage() {
  const router = useRouter()
  const supabase = createClient()

  const [ticker, setTicker] = useState('')
  const [amount, setAmount] = useState('')
  const [fees, setFees] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchingQuote, setFetchingQuote] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const feesNum = parseFloat(fees || '0')

      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Please enter a valid amount')
      }

      if (isNaN(feesNum) || feesNum < 0) {
        throw new Error('Please enter a valid fee amount')
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

      // Insert transaction
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          ticker: ticker,
          date: new Date().toISOString(),
          shares: shares,
          price_at_transaction: quote.price_zar,
          total_fees: feesNum,
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Add Transaction</h1>
          <p className="mt-2 text-sm text-gray-600">
            Record a new investment transaction
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Ticker Input */}
            <div>
              <label htmlFor="ticker" className="block text-sm font-medium text-gray-700">
                Ticker Symbol
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="ticker"
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="STX40"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading || fetchingQuote}
                />
                <button
                  type="button"
                  onClick={handleFetchQuote}
                  disabled={fetchingQuote || loading}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {fetchingQuote ? 'Fetching...' : 'Get Quote'}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                JSE ticker without .JO suffix (e.g., STX40, STXNDQ)
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
                Amount to Invest (ZAR)
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
                  className="pl-7 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading || !quote}
                />
              </div>
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

            {/* Fees Input */}
            <div>
              <label htmlFor="fees" className="block text-sm font-medium text-gray-700">
                Transaction Fees (ZAR)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">R</span>
                </div>
                <input
                  id="fees"
                  type="number"
                  step="0.01"
                  min="0"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                  placeholder="0.00"
                  className="pl-7 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Optional - leave blank if no fees
              </p>
            </div>

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

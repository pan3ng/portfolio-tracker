// File: apps/web/app/transactions/[id]/edit/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchQuote, type Quote } from '@portfolio-tracker/api-client'
import { useRouter, useParams } from 'next/navigation'
import TickerSearch from '@/components/TickerSearch'

export default function EditTransactionPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const transactionId = params.id as string

  const [ticker, setTicker] = useState('')
  const [amount, setAmount] = useState('')
  const [fees, setFees] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchingQuote, setFetchingQuote] = useState(false)
  const [loadingTransaction, setLoadingTransaction] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Original transaction data
  const [originalPrice, setOriginalPrice] = useState(0)
  const [originalShares, setOriginalShares] = useState(0)

  useEffect(() => {
    loadTransaction()
  }, [transactionId])

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

      setTicker(data.ticker)
      setOriginalPrice(data.price_at_transaction)
      setOriginalShares(data.shares)
      setAmount((data.shares * data.price_at_transaction).toFixed(2))
      setFees(data.total_fees.toFixed(2))

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

      // Update transaction
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          ticker: ticker,
          shares: shares,
          price_at_transaction: quote.price_zar,
          total_fees: feesNum,
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

  if (loadingTransaction) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading transaction...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Edit Transaction</h1>
          <p className="mt-2 text-sm text-gray-600">
            Update transaction details or delete it
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
                <TickerSearch
                  value={ticker}
                  onChange={setTicker}
                  disabled={loading || fetchingQuote || deleting}
                />
                <button
                  type="button"
                  onClick={handleFetchQuote}
                  disabled={fetchingQuote || loading || deleting}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {fetchingQuote ? 'Fetching...' : 'Get Quote'}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Search for a ticker or click "Get Quote" to update the price
              </p>
            </div>

            {/* Quote Display */}
            {quote && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-green-900">{quote.ticker}</p>
                    <p className="text-xs text-green-700">
                      Price from {new Date(quote.fetched_at).toLocaleString()}
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
                  className="pl-7 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={loading || !quote || deleting}
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
                {shares !== originalShares && (
                  <p className="mt-1 text-xs text-blue-600">
                    Original: {originalShares.toFixed(6)} shares at R{originalPrice.toFixed(2)}
                  </p>
                )}
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
                  disabled={loading || deleting}
                />
              </div>
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
                disabled={loading || deleting}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading || deleting}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="submit"
                disabled={loading || !quote || !amount || deleting}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

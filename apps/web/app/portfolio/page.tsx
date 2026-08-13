// File: apps/web/app/portfolio/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchQuote, type Transaction, type Target, type Holding } from '@portfolio-tracker/api-client'
import Link from 'next/link'

export default function PortfolioPage() {
  const supabase = createClient()

  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalValue, setTotalValue] = useState(0)

  useEffect(() => {
    loadPortfolio()
  }, [])

  const loadPortfolio = async () => {
    setLoading(true)
    setError(null)

    try {
      // 1. Fetch all transactions for the current user
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })

      if (txError) throw txError

      if (!transactions || transactions.length === 0) {
        setHoldings([])
        setLoading(false)
        return
      }

      // 2. Calculate total shares per ticker from transactions
      const sharesByTicker = new Map<string, number>()
      transactions.forEach((tx: Transaction) => {
        const current = sharesByTicker.get(tx.ticker) || 0
        sharesByTicker.set(tx.ticker, current + tx.shares)
      })

      // Filter out tickers with zero or negative shares (shouldn't happen with current schema)
      const activeTickers = Array.from(sharesByTicker.entries())
        .filter(([_, shares]) => shares > 0)
        .map(([ticker]) => ticker)

      if (activeTickers.length === 0) {
        setHoldings([])
        setLoading(false)
        return
      }

      // 3. Fetch current prices for all active tickers
      const pricePromises = activeTickers.map(async (ticker) => {
        try {
          const quote = await fetchQuote(supabase, ticker)
          return { ticker, price: quote.price_zar }
        } catch (err) {
          console.error(`Failed to fetch quote for ${ticker}:`, err)
          // Return null for failed quotes - we'll handle this below
          return null
        }
      })

      const priceResults = await Promise.all(pricePromises)
      const prices = new Map<string, number>()
      priceResults.forEach((result) => {
        if (result) {
          prices.set(result.ticker, result.price)
        }
      })

      // 4. Fetch target weights
      const { data: targets, error: targetError } = await supabase
        .from('targets')
        .select('*')

      if (targetError) throw targetError

      const targetsByTicker = new Map<string, number>()
      if (targets) {
        targets.forEach((target: Target) => {
          targetsByTicker.set(target.ticker, target.target_weight_pct)
        })
      }

      // 5. Calculate total portfolio value
      let portfolioValue = 0
      activeTickers.forEach((ticker) => {
        const shares = sharesByTicker.get(ticker) || 0
        const price = prices.get(ticker)
        if (price) {
          portfolioValue += shares * price
        }
      })

      setTotalValue(portfolioValue)

      // 6. Build holdings array with weights and drift
      const holdingsData: Holding[] = activeTickers
        .map((ticker) => {
          const shares = sharesByTicker.get(ticker) || 0
          const currentPrice = prices.get(ticker)

          // Skip tickers where we couldn't fetch a price
          if (!currentPrice) {
            return null
          }

          const currentValue = shares * currentPrice
          const currentWeightPct = portfolioValue > 0 ? (currentValue / portfolioValue) * 100 : 0
          const targetWeightPct = targetsByTicker.get(ticker) || 0
          const driftPct = currentWeightPct - targetWeightPct

          return {
            ticker,
            shares,
            current_price: currentPrice,
            current_value: currentValue,
            current_weight_pct: currentWeightPct,
            target_weight_pct: targetWeightPct,
            drift_pct: driftPct,
          }
        })
        .filter((h): h is Holding => h !== null)
        .sort((a, b) => b.current_value - a.current_value) // Sort by value descending

      setHoldings(holdingsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading portfolio...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (holdings.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">No Holdings Yet</h2>
            <p className="mt-2 text-sm text-gray-600">
              Record your first transaction to start tracking your portfolio.
            </p>
            <div className="mt-6">
              <Link
                href="/transactions/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Add Transaction
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Portfolio</h1>
            <p className="mt-2 text-sm text-gray-600">
              Current allocation and rebalancing signals
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/targets"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Edit Targets
            </Link>
            <Link
              href="/transactions/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Add Transaction
            </Link>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {/* Total Portfolio Value Card */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Total Portfolio Value</p>
            <p className="mt-2 text-4xl font-bold text-gray-900">
              R{totalValue.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ticker
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shares
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current %
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target %
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Drift
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {holdings.map((holding) => {
                const isOverweight = holding.drift_pct > 1
                const isUnderweight = holding.drift_pct < -1
                const isBalanced = !isOverweight && !isUnderweight

                return (
                  <tr key={holding.ticker}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {holding.ticker}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {holding.shares.toFixed(6)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      R{holding.current_price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      R{holding.current_value.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {holding.current_weight_pct.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                      {holding.target_weight_pct > 0 ? `${holding.target_weight_pct.toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {holding.target_weight_pct > 0 ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isOverweight
                              ? 'bg-red-100 text-red-800'
                              : isUnderweight
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {holding.drift_pct > 0 ? '+' : ''}
                          {holding.drift_pct.toFixed(1)}%
                          {isOverweight && ' ↓'}
                          {isUnderweight && ' ↑'}
                          {isBalanced && ' ✓'}
                        </span>
                      ) : (
                        <span className="text-gray-400">No target</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-6 bg-white shadow rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Rebalancing Signals</h3>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                -X% ↑
              </span>
              <span className="text-gray-600">Underweight - consider buying</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">
                ±0% ✓
              </span>
              <span className="text-gray-600">Balanced - within 1% of target</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 font-medium">
                +X% ↓
              </span>
              <span className="text-gray-600">Overweight - consider selling or rebalancing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

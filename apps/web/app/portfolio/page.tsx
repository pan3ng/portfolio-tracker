// File: apps/web/app/portfolio/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchQuote, type Transaction, type Target, type Holding } from '@portfolio-tracker/api-client'
import Link from 'next/link'

export default function PortfolioPage() {
  const supabase = createClient()

  const [holdings, setHoldings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalValue, setTotalValue] = useState(0)
  const [totalShareInvestment, setTotalShareInvestment] = useState(0) // NEW: Share value only
  const [totalFeesPaid, setTotalFeesPaid] = useState(0) // NEW: Total fees
  const [totalCostBasis, setTotalCostBasis] = useState(0) // Share investment + fees
  const [totalMarketProfit, setTotalMarketProfit] = useState(0) // NEW: Market gain/loss
  const [totalMarketProfitPct, setTotalMarketProfitPct] = useState(0) // NEW
  const [totalProfitLoss, setTotalProfitLoss] = useState(0) // Total return (after fees)
  const [totalProfitLossPct, setTotalProfitLossPct] = useState(0)

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

      // 2. Calculate total shares, share value, fees, AND cost basis per ticker from transactions
      const sharesByTicker = new Map<string, number>()
      const shareValueByTicker = new Map<string, number>() // NEW: shares × price only
      const feesByTicker = new Map<string, number>() // NEW: total fees per ticker
      const costBasisByTicker = new Map<string, number>()

      transactions.forEach((tx: any) => {
        const currentShares = sharesByTicker.get(tx.ticker) || 0
        const currentShareValue = shareValueByTicker.get(tx.ticker) || 0
        const currentFees = feesByTicker.get(tx.ticker) || 0
        const currentCostBasis = costBasisByTicker.get(tx.ticker) || 0

        sharesByTicker.set(tx.ticker, currentShares + tx.shares)

        // Share value = shares × price_at_transaction (excluding fees)
        const investmentCost = tx.shares * tx.price_at_transaction
        shareValueByTicker.set(tx.ticker, currentShareValue + investmentCost)

        // Calculate total fees for this transaction
        const commissionFee = tx.commission_fee || 0
        const depositFee = tx.deposit_fee || 0
        const fxFee = tx.fx_fee || 0
        const otherFees = tx.other_fees || 0
        const totalFees = commissionFee + depositFee + fxFee + otherFees
        feesByTicker.set(tx.ticker, currentFees + totalFees)

        // Cost basis = shares × price_at_transaction + ALL fees
        const totalCost = investmentCost + totalFees
        costBasisByTicker.set(tx.ticker, currentCostBasis + totalCost)
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

      // 6. Build holdings array with weights, drift, and profit/loss
      const holdingsData = activeTickers
        .map((ticker) => {
          const shares = sharesByTicker.get(ticker) || 0
          const currentPrice = prices.get(ticker)
          const shareValue = shareValueByTicker.get(ticker) || 0  // NEW
          const fees = feesByTicker.get(ticker) || 0  // NEW
          const purchaseValue = costBasisByTicker.get(ticker) || 0

          // Skip tickers where we couldn't fetch a price
          if (!currentPrice) {
            return null
          }

          const currentValue = shares * currentPrice
          const marketProfitLoss = currentValue - shareValue  // NEW: Market movement only
          const marketProfitLossPct = shareValue > 0 ? (marketProfitLoss / shareValue) * 100 : 0  // NEW
          const totalProfitLoss = currentValue - purchaseValue  // Total return (after fees)
          const totalProfitLossPct = purchaseValue > 0 ? (totalProfitLoss / purchaseValue) * 100 : 0
          const currentWeightPct = portfolioValue > 0 ? (currentValue / portfolioValue) * 100 : 0
          const targetWeightPct = targetsByTicker.get(ticker) || 0
          const driftPct = currentWeightPct - targetWeightPct

          return {
            ticker,
            shares,
            share_value: shareValue,  // NEW
            fees: fees,  // NEW
            purchase_value: purchaseValue,  // Total cost (share value + fees)
            current_price: currentPrice,
            current_value: currentValue,
            market_profit_loss: marketProfitLoss,  // NEW
            market_profit_loss_pct: marketProfitLossPct,  // NEW
            profit_loss: totalProfitLoss,  // Renamed conceptually to total_profit_loss
            profit_loss_pct: totalProfitLossPct,
            current_weight_pct: currentWeightPct,
            target_weight_pct: targetWeightPct,
            drift_pct: driftPct,
          }
        })
        .filter((h): h is any => h !== null)
        .sort((a, b) => b.current_value - a.current_value) // Sort by value descending

      // Calculate totals: share investment, fees, cost basis, and profit/loss
      let totalShareInvestment = 0  // NEW: Total share value only
      let totalFeesPaid = 0  // NEW: Total fees
      let totalCost = 0  // Total cost basis (shares + fees)
      let totalMarketProfit = 0  // NEW: Market gain/loss only
      let totalProfit = 0  // Total return (after fees)

      holdingsData.forEach((holding) => {
        totalShareInvestment += holding.share_value
        totalFeesPaid += holding.fees
        totalCost += holding.purchase_value
        totalMarketProfit += holding.market_profit_loss
        totalProfit += holding.profit_loss
      })

      setTotalShareInvestment(totalShareInvestment)
      setTotalFeesPaid(totalFeesPaid)
      setTotalCostBasis(totalCost)
      setTotalMarketProfit(totalMarketProfit)
      setTotalMarketProfitPct(totalShareInvestment > 0 ? (totalMarketProfit / totalShareInvestment) * 100 : 0)
      setTotalProfitLoss(totalProfit)
      setTotalProfitLossPct(totalCost > 0 ? (totalProfit / totalCost) * 100 : 0)
      setHoldings(holdingsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading portfolio...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (holdings.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">No Holdings Yet</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Portfolio</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Current allocation and rebalancing signals
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/targets"
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
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
              href="/transactions/new/historical"
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              + Historical Position
            </Link>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {/* Total Portfolio Summary Card */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Share Investment</p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                R{totalShareInvestment.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Fees Paid</p>
              <p className="mt-1 text-lg font-bold text-orange-600 dark:text-orange-400">
                R{totalFeesPaid.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Cost</p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                R{totalCostBasis.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Current Value</p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                R{totalValue.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Market Gain/Loss</p>
              <p className={`mt-1 text-lg font-bold ${
                totalMarketProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {totalMarketProfit >= 0 ? '+' : ''}R{totalMarketProfit.toFixed(2)}
              </p>
              <p className={`text-xs ${
                totalMarketProfitPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {totalMarketProfitPct >= 0 ? '+' : ''}{totalMarketProfitPct.toFixed(2)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
                Total Return
                <span className="text-gray-400 dark:text-gray-500" title="Total return after fees">ⓘ</span>
              </p>
              <p className={`mt-1 text-lg font-bold ${
                totalProfitLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {totalProfitLoss >= 0 ? '+' : ''}R{totalProfitLoss.toFixed(2)}
              </p>
              <p className={`text-xs ${
                totalProfitLossPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {totalProfitLossPct >= 0 ? '+' : ''}{totalProfitLossPct.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ticker
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Shares
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Share Value
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Fees
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Current Value
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Market P/L
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total P/L
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Current %
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Target %
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Drift
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {holdings.map((holding) => {
                const isOverweight = holding.drift_pct > 1
                const isUnderweight = holding.drift_pct < -1
                const isBalanced = !isOverweight && !isUnderweight
                const isMarketProfitable = holding.market_profit_loss >= 0
                const isTotalProfitable = holding.profit_loss >= 0

                return (
                  <tr key={holding.ticker}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {holding.ticker}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                      {holding.shares.toFixed(6)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                      R{holding.share_value.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-orange-600 dark:text-orange-400">
                      R{holding.fees.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                      R{holding.current_value.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className={`font-medium ${isMarketProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isMarketProfitable ? '+' : ''}R{holding.market_profit_loss.toFixed(2)}
                      </div>
                      <div className={`text-xs ${isMarketProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        ({isMarketProfitable ? '+' : ''}{holding.market_profit_loss_pct.toFixed(2)}%)
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className={`font-medium ${isTotalProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isTotalProfitable ? '+' : ''}R{holding.profit_loss.toFixed(2)}
                      </div>
                      <div className={`text-xs ${isTotalProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        ({isTotalProfitable ? '+' : ''}{holding.profit_loss_pct.toFixed(2)}%)
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                      {holding.current_weight_pct.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                      {holding.target_weight_pct > 0 ? `${holding.target_weight_pct.toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {holding.target_weight_pct > 0 ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isOverweight
                              ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                              : isUnderweight
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                              : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
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
        <div className="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Rebalancing Signals</h3>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium">
                -X% ↑
              </span>
              <span className="text-gray-600 dark:text-gray-400">Underweight - consider buying</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 font-medium">
                ±0% ✓
              </span>
              <span className="text-gray-600 dark:text-gray-400">Balanced - within 1% of target</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 font-medium">
                +X% ↓
              </span>
              <span className="text-gray-600 dark:text-gray-400">Overweight - consider selling or rebalancing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

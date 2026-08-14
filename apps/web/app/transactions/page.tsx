// File: apps/web/app/transactions/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type AccountFilter = 'all' | 'ZAR' | 'USD'

export default function TransactionsPage() {
  const supabase = createClient()

  const [transactions, setTransactions] = useState<any[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all')
  const [tickerFilter, setTickerFilter] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadTransactions()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [accountFilter, tickerFilter, transactions])

  const loadTransactions = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })

      if (fetchError) throw fetchError

      setTransactions(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...transactions]

    // Account filter
    if (accountFilter !== 'all') {
      filtered = filtered.filter(tx => (tx.account_type || 'ZAR') === accountFilter)
    }

    // Ticker filter
    if (tickerFilter.trim()) {
      const searchTerm = tickerFilter.trim().toUpperCase()
      filtered = filtered.filter(tx => tx.ticker.toUpperCase().includes(searchTerm))
    }

    setFilteredTransactions(filtered)
  }

  const toggleRowExpansion = (txId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(txId)) {
      newExpanded.delete(txId)
    } else {
      newExpanded.add(txId)
    }
    setExpandedRows(newExpanded)
  }

  const getTotalFees = (tx: any) => {
    const commission = tx.commission_fee || 0
    const deposit = tx.deposit_fee || 0
    const fx = tx.fx_fee || 0
    const other = tx.other_fees || 0
    return commission + deposit + fx + other
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading transactions...</p>
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">All Transactions</h1>
            <p className="mt-1 text-sm text-gray-600">
              Complete transaction history with filters
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Portfolio
            </Link>
            <Link
              href="/transactions/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              + Add Transaction
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Account Filter */}
            <div>
              <label htmlFor="accountFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Account
              </label>
              <select
                id="accountFilter"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value as AccountFilter)}
                className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              >
                <option value="all">All Accounts</option>
                <option value="ZAR">ZAR</option>
                <option value="USD">USD</option>
              </select>
            </div>

            {/* Ticker Filter */}
            <div>
              <label htmlFor="tickerFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Ticker
              </label>
              <input
                id="tickerFilter"
                type="text"
                value={tickerFilter}
                onChange={(e) => setTickerFilter(e.target.value)}
                placeholder="Search by ticker..."
                className="block w-full rounded-md border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Results count */}
          <div className="mt-3 text-sm text-gray-600">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </div>
        </div>

        {/* Transactions Table */}
        {filteredTransactions.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <p className="text-gray-500">No transactions found matching your filters.</p>
            {(accountFilter !== 'all' || tickerFilter) && (
              <button
                onClick={() => {
                  setAccountFilter('all')
                  setTickerFilter('')
                }}
                className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ticker
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shares
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Fees
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Cost
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map((tx) => {
                  const isExpanded = expandedRows.has(tx.id)
                  const investmentAmount = tx.shares * tx.price_at_transaction
                  const totalFees = getTotalFees(tx)
                  const totalCost = investmentAmount + totalFees

                  return (
                    <>
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(tx.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {tx.ticker}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            {tx.account_type || 'ZAR'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {tx.shares.toFixed(6)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          R{tx.price_at_transaction.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          R{investmentAmount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <button
                            onClick={() => toggleRowExpansion(tx.id)}
                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                          >
                            R{totalFees.toFixed(2)}
                            {isExpanded ? ' ▼' : ' ▶'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                          R{totalCost.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          <Link
                            href={`/transactions/${tx.id}/edit`}
                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>

                      {/* Expanded Fee Breakdown Row */}
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="text-sm">
                              <h4 className="font-medium text-gray-900 mb-2">Fee Breakdown</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                  <span className="text-gray-600">Commission:</span>
                                  <span className="ml-2 font-medium">R{(tx.commission_fee || 0).toFixed(2)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Deposit ({tx.deposit_method || 'card'}):</span>
                                  <span className="ml-2 font-medium">R{(tx.deposit_fee || 0).toFixed(2)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">FX Fee:</span>
                                  <span className="ml-2 font-medium">R{(tx.fx_fee || 0).toFixed(2)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Other:</span>
                                  <span className="ml-2 font-medium">R{(tx.other_fees || 0).toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

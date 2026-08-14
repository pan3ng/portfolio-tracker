// File: apps/web/app/settings/deposits/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Deposit {
  id: string
  amount: number
  date: string
  account_type: 'ZAR' | 'USD'
  description?: string
}

type AccountFilter = 'all' | 'ZAR' | 'USD'

export default function DepositsPage() {
  const supabase = createClient()

  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [filteredDeposits, setFilteredDeposits] = useState<Deposit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    account_type: 'ZAR' as 'ZAR' | 'USD',
    description: '',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadDeposits()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [accountFilter, deposits])

  const loadDeposits = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error: fetchError } = await supabase
        .from('deposits')
        .select('*')
        .order('date', { ascending: false })

      if (fetchError) throw fetchError

      setDeposits(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deposits')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...deposits]

    if (accountFilter !== 'all') {
      filtered = filtered.filter(d => d.account_type === accountFilter)
    }

    setFilteredDeposits(filtered)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const amount = parseFloat(formData.amount)
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount')
      }

      if (!formData.date) {
        throw new Error('Date is required')
      }

      if (editingId) {
        // Update existing deposit
        const { error: updateError } = await supabase
          .from('deposits')
          .update({
            amount,
            date: new Date(formData.date).toISOString(),
            account_type: formData.account_type,
            description: formData.description || null,
          })
          .eq('id', editingId)

        if (updateError) throw updateError
      } else {
        // Insert new deposit
        const { error: insertError } = await supabase
          .from('deposits')
          .insert({
            user_id: user.id,
            amount,
            date: new Date(formData.date).toISOString(),
            account_type: formData.account_type,
            description: formData.description || null,
          })

        if (insertError) throw insertError
      }

      // Reset form and reload
      resetForm()
      await loadDeposits()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save deposit')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (deposit: Deposit) => {
    setFormData({
      amount: deposit.amount.toString(),
      date: new Date(deposit.date).toISOString().split('T')[0],
      account_type: deposit.account_type,
      description: deposit.description || '',
    })
    setEditingId(deposit.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this deposit? This action cannot be undone.')) {
      return
    }

    try {
      const { error: deleteError } = await supabase
        .from('deposits')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      await loadDeposits()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete deposit')
    }
  }

  const resetForm = () => {
    setFormData({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      account_type: 'ZAR',
      description: '',
    })
    setEditingId(null)
    setShowForm(false)
  }

  const calculateTotals = () => {
    const zarTotal = deposits
      .filter(d => d.account_type === 'ZAR')
      .reduce((sum, d) => sum + d.amount, 0)

    const usdTotal = deposits
      .filter(d => d.account_type === 'USD')
      .reduce((sum, d) => sum + d.amount, 0)

    return { zarTotal, usdTotal, allTotal: zarTotal + usdTotal }
  }

  const totals = calculateTotals()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading deposits...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Cash Deposits</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Track cash deposited into your accounts
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/settings"
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Back to Settings
            </Link>
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              {showForm ? 'Cancel' : '+ Add Deposit'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              {editingId ? 'Edit Deposit' : 'Add New Deposit'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Amount */}
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Amount
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 dark:text-gray-400 sm:text-sm">R</span>
                    </div>
                    <input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                      className="pl-7 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="1000.00"
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Date
                  </label>
                  <input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                {/* Account Type */}
                <div>
                  <label htmlFor="account_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Account
                  </label>
                  <select
                    id="account_type"
                    value={formData.account_type}
                    onChange={(e) => setFormData({ ...formData, account_type: e.target.value as 'ZAR' | 'USD' })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="ZAR">ZAR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Description (optional)
                  </label>
                  <input
                    id="description"
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="e.g., Monthly savings"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Deposit' : 'Add Deposit'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Totals Summary */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Total Deposits</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">ZAR Account</p>
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                R{totals.zarTotal.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">USD Account</p>
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                R{totals.usdTotal.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Total (All Accounts)</p>
              <p className="mt-2 text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                R{totals.allTotal.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mb-6">
          <div className="flex items-center gap-4">
            <label htmlFor="accountFilter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by Account:
            </label>
            <select
              id="accountFilter"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value as AccountFilter)}
              className="rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-2 pl-3 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            >
              <option value="all">All Accounts</option>
              <option value="ZAR">ZAR</option>
              <option value="USD">USD</option>
            </select>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredDeposits.length} of {deposits.length} deposits
            </span>
          </div>
        </div>

        {/* Deposits List */}
        {filteredDeposits.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              {deposits.length === 0
                ? "No deposits yet. Add your first deposit to start tracking uninvested capital."
                : "No deposits found matching your filters."}
            </p>
            {deposits.length === 0 && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Add First Deposit
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredDeposits.map((deposit) => (
                  <tr key={deposit.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {new Date(deposit.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                        {deposit.account_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 text-right">
                      R{deposit.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {deposit.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right">
                      <button
                        onClick={() => handleEdit(deposit)}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(deposit.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

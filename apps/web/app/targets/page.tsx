// File: apps/web/app/targets/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { validateTargetsSumTo100, type Target } from '@portfolio-tracker/api-client'
import Link from 'next/link'
import TickerSearch from '@/components/TickerSearch'

interface TargetRow {
  id?: string
  ticker: string
  target_weight_pct: number
  isNew?: boolean
}

export default function TargetsPage() {
  const supabase = createClient()

  const [targets, setTargets] = useState<TargetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    loadTargets()
  }, [])

  const loadTargets = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('targets')
        .select('*')
        .order('ticker', { ascending: true })

      if (fetchError) throw fetchError

      setTargets(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load targets')
    } finally {
      setLoading(false)
    }
  }

  const addNewTarget = () => {
    setTargets([...targets, { ticker: '', target_weight_pct: 0, isNew: true }])
  }

  const removeTarget = (index: number) => {
    setTargets(targets.filter((_, i) => i !== index))
  }

  const updateTarget = (index: number, field: 'ticker' | 'target_weight_pct', value: string | number) => {
    const updated = [...targets]
    if (field === 'ticker') {
      updated[index].ticker = (value as string).toUpperCase()
    } else {
      updated[index].target_weight_pct = typeof value === 'number' ? value : parseFloat(value) || 0
    }
    setTargets(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Validate all tickers are filled
      const emptyTickers = targets.filter(t => !t.ticker.trim())
      if (emptyTickers.length > 0) {
        throw new Error('All tickers must be filled in')
      }

      // Validate sum = 100%
      const validation = validateTargetsSumTo100(targets)
      if (!validation.valid) {
        throw new Error(
          `Target weights must sum to 100%. Current sum: ${validation.sum.toFixed(2)}%`
        )
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Not authenticated')
      }

      // Delete all existing targets for this user
      const { error: deleteError } = await supabase
        .from('targets')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) throw deleteError

      // Insert all new targets
      if (targets.length > 0) {
        const { error: insertError } = await supabase
          .from('targets')
          .insert(
            targets.map(t => ({
              user_id: user.id,
              ticker: t.ticker,
              target_weight_pct: t.target_weight_pct,
            }))
          )

        if (insertError) throw insertError
      }

      setSuccessMessage('Targets saved successfully!')
      await loadTargets()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save targets')
    } finally {
      setSaving(false)
    }
  }

  const validation = validateTargetsSumTo100(targets)
  const sumColor = validation.valid ? 'text-green-600' : 'text-red-600'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading targets...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Target Weights</h1>
            <p className="mt-2 text-sm text-gray-600">
              Set your desired allocation percentages. Must sum to 100%.
            </p>
          </div>
          <Link
            href="/portfolio"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Portfolio
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          )}

          {targets.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No targets set</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by adding your first target allocation.
              </p>
              <div className="mt-6">
                <button
                  onClick={addNewTarget}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  + Add Target
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Targets List */}
              <div className="space-y-3">
                {targets.map((target, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Ticker
                      </label>
                      <TickerSearch
                        value={target.ticker}
                        onChange={(value) => updateTarget(index, 'ticker', value)}
                        placeholder="Search or type ticker"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Target Weight (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={target.target_weight_pct}
                        onChange={(e) => updateTarget(index, 'target_weight_pct', e.target.value)}
                        placeholder="25.0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div className="pt-6">
                      <button
                        onClick={() => removeTarget(index)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sum Display */}
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total:</span>
                  <span className={`text-lg font-bold ${sumColor}`}>
                    {validation.sum.toFixed(2)}%
                  </span>
                </div>
                {!validation.valid && (
                  <p className="mt-1 text-xs text-red-600">
                    Must equal 100% (currently {validation.sum > 100 ? 'over' : 'under'} by {Math.abs(100 - validation.sum).toFixed(2)}%)
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={addNewTarget}
                  className="flex-1 py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  + Add Another Target
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !validation.valid}
                  className="flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Targets'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

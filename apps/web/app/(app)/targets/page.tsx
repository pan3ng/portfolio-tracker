// File: apps/web/app/targets/page.tsx
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validateTargetsSumTo100, fetchQuote, getTickerName } from '@portfolio-tracker/api-client'
import TickerSearch from '@/components/TickerSearch'
import { Card } from '@/components/Card'

const BAR_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

interface TargetRow {
  id?: string
  ticker: string
  target_weight_pct: number
  account_type: 'ZAR' | 'USD'
  isNew?: boolean
}

type AccountFilter = 'ZAR' | 'USD'

export default function TargetsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><p className="text-muted">Loading...</p></div>}>
      <TargetsPageContent />
    </Suspense>
  )
}

function TargetsPageContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()

  const [allTargets, setAllTargets] = useState<TargetRow[]>([])
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('ZAR')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [currentWeights, setCurrentWeights] = useState<Record<string, number>>({})

  useEffect(() => {
    loadTargets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadCurrentWeights(accountFilter)
  }, [accountFilter])

  // Actual current weight per ticker, for the "now X%" column and the weight bar.
  const loadCurrentWeights = async (account: AccountFilter) => {
    try {
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('ticker, shares, account_type')
        .eq('account_type', account)

      if (txError) throw txError
      if (!transactions || transactions.length === 0) {
        setCurrentWeights({})
        return
      }

      const sharesByTicker = new Map<string, number>()
      transactions.forEach((tx: any) => {
        sharesByTicker.set(tx.ticker, (sharesByTicker.get(tx.ticker) || 0) + tx.shares)
      })

      const activeTickers = Array.from(sharesByTicker.entries()).filter(([, shares]) => shares > 0)
      if (activeTickers.length === 0) {
        setCurrentWeights({})
        return
      }

      const priceResults = await Promise.all(
        activeTickers.map(async ([ticker]) => {
          try {
            const quote = await fetchQuote(supabase, ticker)
            return { ticker, price: quote.price_zar }
          } catch {
            return null
          }
        })
      )

      let totalValue = 0
      const valueByTicker = new Map<string, number>()
      activeTickers.forEach(([ticker, shares]) => {
        const result = priceResults.find((r) => r?.ticker === ticker)
        if (!result) return
        const value = shares * result.price
        valueByTicker.set(ticker, value)
        totalValue += value
      })

      const weights: Record<string, number> = {}
      valueByTicker.forEach((value, ticker) => {
        weights[ticker] = totalValue > 0 ? (value / totalValue) * 100 : 0
      })
      setCurrentWeights(weights)
    } catch (err) {
      console.error('Failed to load current weights:', err)
    }
  }

  const loadTargets = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('targets')
        .select('*')
        .order('ticker', { ascending: true })

      if (fetchError) throw fetchError

      // Ensure all targets have an account_type (default to ZAR for old data)
      const targetsWithAccount: TargetRow[] = (data || []).map(t => ({
        ...t,
        account_type: (t.account_type || 'ZAR') as 'ZAR' | 'USD'
      }))

      // Arriving from "Set target →" on a holding: queue a fresh row for its
      // ticker (if it isn't targeted already) so the user only has to type
      // the percentage. Folded into the load itself — rather than a
      // separate effect reacting to `loading` — so it's derived fresh every
      // time targets are (re)loaded and can't be clobbered by React Strict
      // Mode's double effect-invocation in dev firing two concurrent loads.
      const presetTicker = searchParams.get('ticker')
      let finalTargets = targetsWithAccount
      if (presetTicker) {
        const ticker = presetTicker.toUpperCase()
        const presetAccount: AccountFilter = searchParams.get('account') === 'USD' ? 'USD' : 'ZAR'
        const exists = targetsWithAccount.some(t => t.ticker === ticker && t.account_type === presetAccount)
        if (!exists) {
          finalTargets = [...targetsWithAccount, { ticker, target_weight_pct: 0, account_type: presetAccount, isNew: true }]
        }
        setAccountFilter(presetAccount)
      }

      setAllTargets(finalTargets)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load targets')
    } finally {
      setLoading(false)
    }
  }

  // Filter targets by current account
  const targets = allTargets.filter(t => t.account_type === accountFilter)

  const addNewTarget = () => {
    setAllTargets([...allTargets, { ticker: '', target_weight_pct: 0, account_type: accountFilter, isNew: true }])
  }

  const removeTarget = (index: number) => {
    // Find the actual index in allTargets
    const targetToRemove = targets[index]
    setAllTargets(allTargets.filter(t => t !== targetToRemove))
  }

  const updateTarget = (index: number, field: 'ticker' | 'target_weight_pct', value: string | number) => {
    // Find the actual target in allTargets
    const targetToUpdate = targets[index]
    if (!targetToUpdate) return

    const allTargetsIndex = allTargets.indexOf(targetToUpdate)
    if (allTargetsIndex === -1) return

    const updated = [...allTargets]
    const targetToEdit = updated[allTargetsIndex]
    if (!targetToEdit) return

    if (field === 'ticker') {
      targetToEdit.ticker = (value as string).toUpperCase()
    } else {
      targetToEdit.target_weight_pct = typeof value === 'number' ? value : parseFloat(value) || 0
    }
    setAllTargets(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Validate all tickers are filled
      const emptyTickers = allTargets.filter(t => !t.ticker.trim())
      if (emptyTickers.length > 0) {
        throw new Error('All tickers must be filled in')
      }

      // Validate sum = 100% for EACH account independently
      const zarTargets = allTargets.filter(t => t.account_type === 'ZAR')
      const usdTargets = allTargets.filter(t => t.account_type === 'USD')

      if (zarTargets.length > 0) {
        const zarValidation = validateTargetsSumTo100(zarTargets)
        if (!zarValidation.valid) {
          throw new Error(
            `ZAR target weights must sum to 100%. Current sum: ${zarValidation.sum.toFixed(2)}%`
          )
        }
      }

      if (usdTargets.length > 0) {
        const usdValidation = validateTargetsSumTo100(usdTargets)
        if (!usdValidation.valid) {
          throw new Error(
            `USD target weights must sum to 100%. Current sum: ${usdValidation.sum.toFixed(2)}%`
          )
        }
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

      // Insert all new targets (both ZAR and USD)
      if (allTargets.length > 0) {
        const { error: insertError } = await supabase
          .from('targets')
          .insert(
            allTargets.map(t => ({
              user_id: user.id,
              ticker: t.ticker,
              target_weight_pct: t.target_weight_pct,
              account_type: t.account_type,
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

  if (loading) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><p className="text-muted">Loading targets...</p></div>
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '26px 24px 30px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: 28 }}>What share should each fund be?</h2>
        <p style={{ fontSize: 14, opacity: 0.7, margin: 0 }}>
          Set the split you&apos;re aiming for. We&apos;ll tell you when real life drifts away from it — we never move money for you.
        </p>
      </div>

      {/* Account Filter Tabs */}
      <span className="seg" style={{ alignSelf: 'flex-start' }}>
        <span className={`seg-opt${accountFilter === 'ZAR' ? ' is-active' : ''}`} onClick={() => setAccountFilter('ZAR')}>
          ZAR{allTargets.filter(t => t.account_type === 'ZAR').length > 0 && ` (${allTargets.filter(t => t.account_type === 'ZAR').length})`}
        </span>
        <span className={`seg-opt${accountFilter === 'USD' ? ' is-active' : ''}`} onClick={() => setAccountFilter('USD')}>
          USD{allTargets.filter(t => t.account_type === 'USD').length > 0 && ` (${allTargets.filter(t => t.account_type === 'USD').length})`}
        </span>
      </span>

      {error && (
        <Card style={{ borderColor: 'var(--color-loss)' }}>
          <p style={{ margin: 0, color: 'var(--color-loss)' }}>{error}</p>
        </Card>
      )}

      {successMessage && (
        <Card style={{ borderColor: 'var(--color-accent)' }}>
          <p style={{ margin: 0, color: 'var(--color-accent-700)' }}>{successMessage}</p>
        </Card>
      )}

      {targets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
            <h5>No {accountFilter} targets set</h5>
            <p className="text-muted" style={{ fontSize: 13 }}>
              Get started by adding your first target allocation for the {accountFilter} account.
            </p>
            <button onClick={addNewTarget} className="btn btn-primary" style={{ marginTop: 'var(--space-3)' }}>
              + Add {accountFilter} Target
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {targets.map((target, index) => {
                const now = currentWeights[target.ticker.toUpperCase()] ?? 0
                const drift = now - target.target_weight_pct
                const isOff = Math.abs(drift) > 1
                const name = target.ticker ? getTickerName(target.ticker) : undefined

                return (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 96px 92px 32px', gap: 16, alignItems: 'center' }}>
                    <div>
                      <TickerSearch
                        value={target.ticker}
                        onChange={(value) => updateTarget(index, 'ticker', value)}
                        placeholder="Ticker"
                        inputClassName=""
                        inputStyle={{
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          padding: 0,
                          minHeight: 'auto',
                          width: '100%',
                          fontFamily: 'var(--font-heading)',
                          fontWeight: 600,
                          fontSize: 17,
                          color: 'var(--color-text)',
                        }}
                      />
                      {name && <div className="text-muted" style={{ fontSize: 11.5, marginTop: 4 }}>{name}</div>}
                    </div>
                    <div className="weight-bar">
                      <div className="fill" style={{ width: `${Math.min(now, 100)}%`, background: BAR_COLORS[index % BAR_COLORS.length] }} />
                      <div className="target" style={{ left: `${Math.min(target.target_weight_pct, 100)}%` }} />
                    </div>
                    <input
                      type="number" step="0.1" min="0" max="100" className="input num"
                      style={{ textAlign: 'right' }}
                      value={target.target_weight_pct}
                      onChange={(e) => updateTarget(index, 'target_weight_pct', e.target.value)}
                      placeholder="25.0"
                    />
                    <div className="num" style={{ fontSize: 12.5, textAlign: 'right', color: isOff ? 'var(--color-loss)' : 'color-mix(in srgb, var(--color-text) 60%, transparent)' }}>
                      now {now.toFixed(1)}%
                    </div>
                    <button onClick={() => removeTarget(index)} className="btn btn-ghost btn-icon" style={{ color: 'var(--color-loss)' }} aria-label="Remove target">
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>

            <button onClick={addNewTarget} className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
              + Add Another {accountFilter} Target
            </button>

            <Card style={{ padding: '16px 20px', flexDirection: 'row', alignItems: 'center', gap: 16, background: validation.valid ? 'var(--color-accent-wash)' : 'var(--color-loss-tint)' }}>
              <div className="num" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, color: validation.valid ? undefined : 'var(--color-loss)' }}>
                {validation.sum.toFixed(1)}%
              </div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                {validation.valid
                  ? "Adds up — you're good to save."
                  : `Must equal 100% (currently ${validation.sum > 100 ? 'over' : 'under'} by ${Math.abs(100 - validation.sum).toFixed(2)}%)`}
              </div>
              <button onClick={handleSave} disabled={saving || !validation.valid} className="btn btn-primary" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                {saving ? 'Saving...' : 'Save plan'}
              </button>
            </Card>
          </div>
        )}
    </div>
  )
}

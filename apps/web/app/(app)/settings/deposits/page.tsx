// File: apps/web/app/settings/deposits/page.tsx
'use client'

import { Suspense, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Card } from '@/components/Card'

interface Deposit {
  id: string
  amount: number
  date: string
  account_type: 'ZAR' | 'USD'
  deposit_method: 'card' | 'eft'
  deposit_fee: number
  description?: string
}

interface UserSettings {
  default_card_deposit_pct: number
  default_eft_deposit_pct: number
}

const DEFAULT_SETTINGS: UserSettings = {
  default_card_deposit_pct: 2.0,
  default_eft_deposit_pct: 0.0,
}

type AccountFilter = 'all' | 'ZAR' | 'USD'

export default function DepositsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><p className="text-muted">Loading...</p></div>}>
      <DepositsPageContent />
    </Suspense>
  )
}

function DepositsPageContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()

  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [filteredDeposits, setFilteredDeposits] = useState<Deposit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all')
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS)

  // Form state
  const [showForm, setShowForm] = useState(searchParams.get('new') === 'true')
  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    account_type: 'ZAR' as 'ZAR' | 'USD',
    deposit_method: 'card' as 'card' | 'eft',
    description: '',
  })
  const [feeManuallySet, setFeeManuallySet] = useState(false)
  const [depositFee, setDepositFee] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadDeposits()
    loadUserSettings()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [accountFilter, deposits])

  // Auto-calculate the deposit fee from the chosen method, unless the user typed their own
  useEffect(() => {
    if (feeManuallySet) return
    const amountNum = parseFloat(formData.amount) || 0
    const pct = formData.deposit_method === 'card' ? userSettings.default_card_deposit_pct : userSettings.default_eft_deposit_pct
    setDepositFee((amountNum * pct) / 100)
  }, [formData.amount, formData.deposit_method, userSettings, feeManuallySet])

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
          default_card_deposit_pct: data.default_card_deposit_pct,
          default_eft_deposit_pct: data.default_eft_deposit_pct,
        })
      }
    } catch (err) {
      console.error('Failed to load user settings:', err)
    }
  }

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
            deposit_method: formData.deposit_method,
            deposit_fee: depositFee,
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
            deposit_method: formData.deposit_method,
            deposit_fee: depositFee,
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
      deposit_method: deposit.deposit_method || 'card',
      description: deposit.description || '',
    })
    setDepositFee(deposit.deposit_fee || 0)
    setFeeManuallySet(true) // preserve the deposit's saved fee rather than recalculating it
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
      deposit_method: 'card',
      description: '',
    })
    setDepositFee(0)
    setFeeManuallySet(false)
    setEditingId(null)
    setShowForm(false)
  }

  const calculateTotals = () => {
    const zarDeposits = deposits.filter(d => d.account_type === 'ZAR')
    const usdDeposits = deposits.filter(d => d.account_type === 'USD')

    const zarTotal = zarDeposits.reduce((sum, d) => sum + d.amount, 0)
    const usdTotal = usdDeposits.reduce((sum, d) => sum + d.amount, 0)
    const zarFees = zarDeposits.reduce((sum, d) => sum + (d.deposit_fee || 0), 0)
    const usdFees = usdDeposits.reduce((sum, d) => sum + (d.deposit_fee || 0), 0)

    return { zarTotal, usdTotal, allTotal: zarTotal + usdTotal, zarFees, usdFees }
  }

  const totals = calculateTotals()

  if (loading) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><p className="text-muted">Loading deposits...</p></div>
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--space-6) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="text-muted" style={{ margin: 0 }}>Track cash deposited into your accounts</p>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? 'Cancel' : '+ Add Deposit'}
        </button>
      </div>

      {error && (
        <Card style={{ borderColor: 'var(--color-loss)' }}>
          <p style={{ margin: 0, color: 'var(--color-loss)' }}>{error}</p>
        </Card>
      )}

      {showForm && (
        <Card style={{ padding: 'var(--space-6)' }}>
          <h4 style={{ marginBottom: 12 }}>{editingId ? 'Edit Deposit' : 'Add New Deposit'}</h4>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="field">
                <label htmlFor="amount">Amount ({formData.account_type})</label>
                <input
                  id="amount" type="number" step="0.01" min="0.01" required className="input"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder={formData.account_type === 'USD' ? '$ 1000.00' : 'R 1000.00'}
                />
              </div>
              <div className="field">
                <label htmlFor="date">Date</label>
                <input
                  id="date" type="date" required className="input"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="account_type">Account</label>
                <select
                  id="account_type" className="input"
                  value={formData.account_type}
                  onChange={(e) => setFormData({ ...formData, account_type: e.target.value as 'ZAR' | 'USD' })}
                >
                  <option value="ZAR">ZAR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="deposit_method">Deposit Method</label>
                <select
                  id="deposit_method" className="input"
                  value={formData.deposit_method}
                  onChange={(e) => setFormData({ ...formData, deposit_method: e.target.value as 'card' | 'eft' })}
                >
                  <option value="card">Card ({userSettings.default_card_deposit_pct}% fee)</option>
                  <option value="eft">EFT ({userSettings.default_eft_deposit_pct}% fee)</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="depositFee">
                  Fee charged on top {feeManuallySet && <span style={{ opacity: 0.6, fontWeight: 400 }}>(edited)</span>}
                </label>
                <input
                  id="depositFee" type="number" step="0.01" min="0" className="input"
                  value={depositFee.toFixed(2)}
                  onChange={(e) => { setDepositFee(parseFloat(e.target.value) || 0); setFeeManuallySet(true) }}
                />
              </div>
              <div className="field">
                <label htmlFor="description">Description (optional)</label>
                <input
                  id="description" type="text" className="input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Monthly savings"
                />
              </div>
            </div>
            <p className="text-muted" style={{ fontSize: 11, margin: 0 }}>
              The fee is what your bank/broker charged you for this deposit — it&apos;s tracked for the record, not deducted from the amount above.
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button type="button" onClick={resetForm} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1 }}>
                {submitting ? 'Saving...' : editingId ? 'Update Deposit' : 'Add Deposit'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Totals Summary */}
      <Card style={{ padding: 'var(--space-6)' }}>
        <h4 style={{ marginBottom: 12 }}>Total Deposits</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
          <Card style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
            <div className="text-muted" style={{ fontSize: 12 }}>ZAR Account</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 600 }}>R{totals.zarTotal.toFixed(2)}</div>
            {totals.zarFees > 0 && <div className="text-muted num" style={{ fontSize: 11 }}>R{totals.zarFees.toFixed(2)} in deposit fees</div>}
          </Card>
          <Card style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
            <div className="text-muted" style={{ fontSize: 12 }}>USD Account</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 600 }}>${totals.usdTotal.toFixed(2)}</div>
            {totals.usdFees > 0 && <div className="text-muted num" style={{ fontSize: 11 }}>${totals.usdFees.toFixed(2)} in deposit fees</div>}
          </Card>
          <Card style={{ textAlign: 'center', padding: 'var(--space-4)', borderColor: 'var(--color-accent)' }}>
            <div style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>Total (All Accounts)</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-accent-700)' }}>R{totals.allTotal.toFixed(2)}</div>
          </Card>
        </div>
      </Card>

      {/* Filters */}
      <Card style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <label htmlFor="accountFilter" style={{ fontSize: 13 }}>Filter by Account</label>
        <select
          id="accountFilter" className="input" style={{ width: 'auto' }}
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value as AccountFilter)}
        >
          <option value="all">All Accounts</option>
          <option value="ZAR">ZAR</option>
          <option value="USD">USD</option>
        </select>
        <span className="text-muted" style={{ fontSize: 12 }}>
          Showing {filteredDeposits.length} of {deposits.length} deposits
        </span>
      </Card>

      {/* Deposits List */}
      {filteredDeposits.length === 0 ? (
        <Card dashed style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <p className="text-muted">
            {deposits.length === 0
              ? 'No deposits yet. Add your first deposit to start tracking uninvested capital.'
              : 'No deposits found matching your filters.'}
          </p>
          {deposits.length === 0 && (
            <button onClick={() => setShowForm(true)} className="btn btn-primary" style={{ marginTop: 'var(--space-2)' }}>
              Add First Deposit
            </button>
          )}
        </Card>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Method</th>
                <th style={{ textAlign: 'right' }}>Fee</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeposits.map((deposit) => {
                const symbol = deposit.account_type === 'USD' ? '$' : 'R'
                return (
                  <tr key={deposit.id}>
                    <td className="num">{new Date(deposit.date).toLocaleDateString()}</td>
                    <td><span className="tag tag-neutral">{deposit.account_type}</span></td>
                    <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>{symbol}{deposit.amount.toFixed(2)}</td>
                    <td className="text-muted">{(deposit.deposit_method || 'card').toUpperCase()}</td>
                    <td className="num text-muted" style={{ textAlign: 'right' }}>{symbol}{(deposit.deposit_fee || 0).toFixed(2)}</td>
                    <td className="text-muted">{deposit.description || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => handleEdit(deposit)} className="btn btn-ghost">Edit</button>
                      <button onClick={() => handleDelete(deposit.id)} className="btn btn-ghost" style={{ color: 'var(--color-loss)' }}>Delete</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

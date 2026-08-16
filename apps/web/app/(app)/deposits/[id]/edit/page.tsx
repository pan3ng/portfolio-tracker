// File: apps/web/app/deposits/[id]/edit/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/Card'

type AccountType = 'ZAR' | 'USD'
type DepositMethod = 'card' | 'eft'
type MovementType = 'deposit' | 'withdrawal'

interface UserSettings {
  default_card_deposit_pct: number
  default_eft_deposit_pct: number
}

const DEFAULT_SETTINGS: UserSettings = {
  default_card_deposit_pct: 2.0,
  default_eft_deposit_pct: 0.0,
}

export default function EditDepositPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const depositId = params.id as string

  const [movementType, setMovementType] = useState<MovementType>('deposit')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('ZAR')
  const [depositMethod, setDepositMethod] = useState<DepositMethod>('card')
  const [depositFee, setDepositFee] = useState(0)
  const [description, setDescription] = useState('')

  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [loadingDeposit, setLoadingDeposit] = useState(true)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadUserSettings()
    loadDeposit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositId])

  const loadUserSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error: fetchError } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()
      if (fetchError && fetchError.code !== 'PGRST116') console.error('Error loading settings:', fetchError)
      if (data) {
        setUserSettings({
          default_card_deposit_pct: data.default_card_deposit_pct,
          default_eft_deposit_pct: data.default_eft_deposit_pct,
        })
      }
    } catch (err) {
      console.error('Failed to load user settings:', err)
    } finally {
      setLoadingSettings(false)
    }
  }

  const loadDeposit = async () => {
    setLoadingDeposit(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase.from('deposits').select('*').eq('id', depositId).single()
      if (fetchError) throw fetchError
      if (!data) throw new Error('Not found')

      setMovementType(data.movement_type === 'withdrawal' ? 'withdrawal' : 'deposit')
      setAmount(data.amount.toString())
      setDate(new Date(data.date).toISOString().split('T')[0] as string)
      setAccountType((data.account_type || 'ZAR') as AccountType)
      setDepositMethod((data.deposit_method || 'card') as DepositMethod)
      setDepositFee(data.deposit_fee || 0)
      setDescription(data.description || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoadingDeposit(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const amountNum = parseFloat(amount)
      if (isNaN(amountNum) || amountNum <= 0) throw new Error('Please enter a valid amount')
      if (!date) throw new Error('Date is required')

      const { error: updateError } = await supabase.from('deposits').update({
        amount: amountNum,
        date: new Date(date).toISOString(),
        account_type: accountType,
        movement_type: movementType,
        deposit_method: depositMethod,
        deposit_fee: depositFee,
        description: description.trim() || null,
      }).eq('id', depositId)

      if (updateError) throw updateError
      router.push('/transactions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete this ${movementType}? This action cannot be undone.`)) return
    setDeleting(true)
    setError(null)
    try {
      const { error: deleteError } = await supabase.from('deposits').delete().eq('id', depositId)
      if (deleteError) throw deleteError
      router.push('/transactions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setDeleting(false)
    }
  }

  const currencySymbol = accountType === 'USD' ? '$' : 'R'

  if (loadingDeposit || loadingSettings) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><p className="text-muted">Loading...</p></div>
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>Update this cash movement or delete it</p>

      <Card style={{ padding: 'var(--space-6)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <span className="seg" style={{ width: '100%' }}>
            <span
              className={`seg-opt${movementType === 'deposit' ? ' is-active' : ''}`}
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => !saving && !deleting && setMovementType('deposit')}
            >
              Deposit
            </span>
            <span
              className={`seg-opt${movementType === 'withdrawal' ? ' is-active' : ''}`}
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => !saving && !deleting && setMovementType('withdrawal')}
            >
              Withdrawal
            </span>
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="field">
              <label htmlFor="amount">Amount ({accountType})</label>
              <input
                id="amount" type="number" step="0.01" min="0.01" required className="input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`${currencySymbol} 1000.00`}
                disabled={saving || deleting}
              />
            </div>
            <div className="field">
              <label htmlFor="date">Date</label>
              <input
                id="date" type="date" required className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={saving || deleting}
              />
            </div>
            <div className="field">
              <label htmlFor="accountType">Account</label>
              <select
                id="accountType" className="input"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as AccountType)}
                disabled={saving || deleting}
              >
                <option value="ZAR">ZAR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            {movementType === 'deposit' && (
              <div className="field">
                <label htmlFor="depositMethod">Deposit Method</label>
                <select
                  id="depositMethod" className="input"
                  value={depositMethod}
                  onChange={(e) => setDepositMethod(e.target.value as DepositMethod)}
                  disabled={saving || deleting}
                >
                  <option value="card">Card ({userSettings.default_card_deposit_pct}% fee)</option>
                  <option value="eft">EFT ({userSettings.default_eft_deposit_pct}% fee)</option>
                </select>
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="depositFee">Fee charged on top</label>
            <input
              id="depositFee" type="number" step="0.01" min="0" className="input"
              value={depositFee.toFixed(2)}
              onChange={(e) => setDepositFee(parseFloat(e.target.value) || 0)}
              disabled={saving || deleting}
            />
          </div>

          <div className="field">
            <label htmlFor="description">Description (optional)</label>
            <input
              id="description" type="text" className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={movementType === 'deposit' ? 'e.g., Monthly savings' : 'e.g., Cash needed elsewhere'}
              disabled={saving || deleting}
            />
          </div>

          {error && (
            <Card style={{ borderColor: 'var(--color-loss)' }}>
              <p style={{ margin: 0, color: 'var(--color-loss)' }}>{error}</p>
            </Card>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="button" onClick={() => router.push('/transactions')} disabled={saving || deleting} className="btn btn-secondary" style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="button" onClick={handleDelete} disabled={saving || deleting} className="btn" style={{ flex: 1, borderColor: 'var(--color-loss)', color: 'var(--color-loss)' }}>
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
            <button type="submit" disabled={saving || deleting || !amount} className="btn btn-primary" style={{ flex: 1 }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}

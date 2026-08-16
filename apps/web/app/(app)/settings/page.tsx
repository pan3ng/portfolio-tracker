// File: apps/web/app/settings/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/components/ThemeProvider'
import { Card } from '@/components/Card'

interface UserSettings {
  default_commission_pct: number
  default_card_deposit_pct: number
  default_eft_deposit_pct: number
  default_fx_pct: number
  theme: 'light' | 'dark' | 'system'
}

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { theme: currentTheme, setTheme: setAppTheme } = useTheme()

  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [settings, setSettings] = useState<UserSettings>({
    default_commission_pct: 0.25,
    default_card_deposit_pct: 2.0,
    default_eft_deposit_pct: 0.0,
    default_fx_pct: 0.5,
    theme: 'system',
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  // Sync local settings with ThemeProvider's current theme
  useEffect(() => {
    setSettings(prev => ({ ...prev, theme: currentTheme }))
  }, [currentTheme])

  const loadSettings = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error: fetchError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (fetchError) {
        // Settings don't exist yet, use defaults
        if (fetchError.code === 'PGRST116') {
          // This is expected for new users
          setLoading(false)
          return
        }
        throw fetchError
      }

      if (data) {
        setSettings({
          default_commission_pct: data.default_commission_pct,
          default_card_deposit_pct: data.default_card_deposit_pct,
          default_eft_deposit_pct: data.default_eft_deposit_pct,
          default_fx_pct: data.default_fx_pct,
          theme: data.theme as 'light' | 'dark' | 'system',
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Validate percentages
      if (settings.default_commission_pct < 0 || settings.default_commission_pct > 100) {
        throw new Error('Commission percentage must be between 0 and 100')
      }
      if (settings.default_card_deposit_pct < 0 || settings.default_card_deposit_pct > 100) {
        throw new Error('Card deposit percentage must be between 0 and 100')
      }
      if (settings.default_eft_deposit_pct < 0 || settings.default_eft_deposit_pct > 100) {
        throw new Error('EFT deposit percentage must be between 0 and 100')
      }
      if (settings.default_fx_pct < 0 || settings.default_fx_pct > 100) {
        throw new Error('FX percentage must be between 0 and 100')
      }

      // Upsert settings (insert or update)
      const { error: saveError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          default_commission_pct: settings.default_commission_pct,
          default_card_deposit_pct: settings.default_card_deposit_pct,
          default_eft_deposit_pct: settings.default_eft_deposit_pct,
          default_fx_pct: settings.default_fx_pct,
          theme: settings.theme,
        })

      if (saveError) throw saveError

      setSuccessMessage('Settings saved successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleClearData = async () => {
    if (clearConfirmText !== 'CLEAR') return
    setClearing(true)
    setClearError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: txError } = await supabase.from('transactions').delete().eq('user_id', user.id)
      if (txError) throw txError
      const { error: targetsError } = await supabase.from('targets').delete().eq('user_id', user.id)
      if (targetsError) throw targetsError
      const { error: depositsError } = await supabase.from('deposits').delete().eq('user_id', user.id)
      if (depositsError) throw depositsError
      const { error: settingsError } = await supabase.from('user_settings').delete().eq('user_id', user.id)
      if (settingsError) throw settingsError

      router.push('/')
    } catch (err) {
      setClearError(err instanceof Error ? err.message : 'Failed to clear data')
      setClearing(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return
    setDeleting(true)
    setDeleteError(null)

    try {
      const { error } = await supabase.functions.invoke('delete-account')
      if (error) throw error

      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p className="text-muted">Loading settings...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-8) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
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

      {/* Fee Defaults Section */}
      <Card style={{ padding: 'var(--space-6)', gap: 'var(--space-4)' }}>
        <div>
          <h4 style={{ marginBottom: 4 }}>Default Fee Percentages</h4>
          <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
            Used when adding new transactions. You can still adjust fees per transaction.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <div className="field">
            <label htmlFor="commission">Commission (%)</label>
            <input
              type="number" id="commission" step="0.01" min="0" max="100" className="input"
              value={settings.default_commission_pct}
              onChange={(e) => setSettings({ ...settings, default_commission_pct: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Typical: 0.25% (EasyEquities standard)</p>
          </div>

          <div className="field">
            <label htmlFor="cardDeposit">Card Deposit Fee (%)</label>
            <input
              type="number" id="cardDeposit" step="0.1" min="0" max="100" className="input"
              value={settings.default_card_deposit_pct}
              onChange={(e) => setSettings({ ...settings, default_card_deposit_pct: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Typical range: 1-2% (varies by card provider)</p>
          </div>

          <div className="field">
            <label htmlFor="eftDeposit">EFT Deposit Fee (%)</label>
            <input
              type="number" id="eftDeposit" step="0.1" min="0" max="100" className="input"
              value={settings.default_eft_deposit_pct}
              onChange={(e) => setSettings({ ...settings, default_eft_deposit_pct: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Typical: 0% (EFT deposits are usually free)</p>
          </div>

          <div className="field">
            <label htmlFor="fx">Foreign Exchange Fee (%)</label>
            <input
              type="number" id="fx" step="0.1" min="0" max="100" className="input"
              value={settings.default_fx_pct}
              onChange={(e) => setSettings({ ...settings, default_fx_pct: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Typical: 0.5% (for USD transactions)</p>
          </div>
        </div>
      </Card>

      {/* Appearance Section */}
      <Card style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
          <div>
            <h4 style={{ margin: '0 0 4px', fontSize: 17 }}>Appearance</h4>
            <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>Follows your device unless you pick one.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="seg" style={{ alignSelf: 'flex-start' }}>
              <span
                className={`seg-opt${settings.theme === 'light' ? ' is-active' : ''}`}
                onClick={() => {
                  setSettings({ ...settings, theme: 'light' })
                  setAppTheme('light')
                }}
              >
                Light
              </span>
              <span
                className={`seg-opt${settings.theme === 'dark' ? ' is-active' : ''}`}
                onClick={() => {
                  setSettings({ ...settings, theme: 'dark' })
                  setAppTheme('dark')
                }}
              >
                Dark
              </span>
              <span
                className={`seg-opt${settings.theme === 'system' ? ' is-active' : ''}`}
                onClick={() => {
                  setSettings({ ...settings, theme: 'system' })
                  setAppTheme('system')
                }}
              >
                Match device
              </span>
            </span>
            <div style={{ display: 'flex', gap: 14 }}>
              <div className="blueprint" style={{ position: 'relative', width: 150, padding: 12, background: '#f2f2f3' }}>
                <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
                <div className="num" style={{ fontSize: 11, color: '#1d1f20' }}>R 487 320</div>
                <div style={{ height: 5, background: '#5980a6', marginTop: 8, width: '70%' }} />
              </div>
              <div className="blueprint" style={{ position: 'relative', width: 150, padding: 12, background: '#15181b' }}>
                <i className="corner tl" style={{ color: 'rgba(233,235,237,.5)' }} /><i className="corner tr" style={{ color: 'rgba(233,235,237,.5)' }} /><i className="corner bl" style={{ color: 'rgba(233,235,237,.5)' }} /><i className="corner br" style={{ color: 'rgba(233,235,237,.5)' }} />
                <div className="num" style={{ fontSize: 11, color: '#e9ebed' }}>R 487 320</div>
                <div style={{ height: 5, background: '#94bce3', marginTop: 8, width: '70%' }} />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Data Management */}
      <Card style={{ padding: 'var(--space-6)', gap: 'var(--space-4)' }}>
        <h4 style={{ marginBottom: 0 }}>Data Management</h4>
        <div>
          <h5 style={{ marginBottom: 4 }}>Cash deposits &amp; withdrawals</h5>
          <p className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
            Deposits and withdrawals now live in the Activity ledger alongside your buys,
            filterable by type
          </p>
          <Link href="/transactions" className="btn btn-primary">View Activity</Link>
        </div>
        <div className="hr" />
        <div>
          <h5 style={{ marginBottom: 4 }}>Import Historical Transactions</h5>
          <p className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
            Bulk import your historical positions from a CSV file
          </p>
          <Link href="/settings/import" className="btn btn-secondary">Import from CSV</Link>
        </div>
        <div className="hr" />
        <div>
          <h5 style={{ marginBottom: 4 }}>Add a historical position</h5>
          <p className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
            Add Transaction has a &quot;historical purchase&quot; toggle for a custom date and price
          </p>
          <Link href="/transactions/new" className="btn btn-secondary">Add Transaction</Link>
        </div>
      </Card>

      {/* Future Features */}
      <Card dashed style={{ padding: 'var(--space-6)', gap: 'var(--space-3)' }}>
        <h4 className="text-muted" style={{ marginBottom: 0 }}>Coming soon</h4>
        <div className="text-muted" style={{ fontSize: 13 }}>
          <div style={{ fontWeight: 600 }}>Notifications</div>
          <p style={{ fontSize: 12, margin: 0 }}>Email alerts for rebalancing signals and portfolio milestones</p>
        </div>
        <div className="text-muted" style={{ fontSize: 13 }}>
          <div style={{ fontWeight: 600 }}>Data Export</div>
          <p style={{ fontSize: 12, margin: 0 }}>Export your portfolio data to CSV format</p>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card style={{ padding: 'var(--space-6)', gap: 'var(--space-4)', borderColor: 'var(--color-loss)' }}>
        <h4 style={{ marginBottom: 0, color: 'var(--color-loss)' }}>Danger Zone</h4>

        <div>
          <h5 style={{ marginBottom: 4 }}>Clear My Data</h5>
          <p className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
            Deletes all transactions, targets, deposits, and fee settings. Your login stays active — you&apos;ll land on a fresh, empty account.
          </p>
          {!showClearConfirm ? (
            <button
              type="button" onClick={() => setShowClearConfirm(true)}
              className="btn" style={{ borderColor: 'var(--color-loss)', color: 'var(--color-loss)' }}
            >
              Clear My Data
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
              <label htmlFor="clearConfirm" style={{ fontSize: 12 }}>Type CLEAR to confirm</label>
              <input
                id="clearConfirm" type="text" className="input"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                disabled={clearing}
              />
              {clearError && <p style={{ margin: 0, fontSize: 12, color: 'var(--color-loss)' }}>{clearError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button" onClick={handleClearData}
                  disabled={clearConfirmText !== 'CLEAR' || clearing}
                  className="btn btn-primary" style={{ background: 'var(--color-loss)', borderColor: 'var(--color-loss)' }}
                >
                  {clearing ? 'Clearing...' : 'Confirm: Clear My Data'}
                </button>
                <button
                  type="button" onClick={() => { setShowClearConfirm(false); setClearConfirmText(''); setClearError(null) }}
                  disabled={clearing} className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="hr" />

        <div>
          <h5 style={{ marginBottom: 4 }}>Delete My Account</h5>
          <p className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
            Permanently deletes your account and all data. This cannot be undone — you won&apos;t be able to log back in.
          </p>
          {!showDeleteConfirm ? (
            <button
              type="button" onClick={() => setShowDeleteConfirm(true)}
              className="btn" style={{ borderColor: 'var(--color-loss)', color: 'var(--color-loss)' }}
            >
              Delete My Account
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
              <label htmlFor="deleteConfirm" style={{ fontSize: 12 }}>Type DELETE to confirm</label>
              <input
                id="deleteConfirm" type="text" className="input"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                disabled={deleting}
              />
              {deleteError && <p style={{ margin: 0, fontSize: 12, color: 'var(--color-loss)' }}>{deleteError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button" onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                  className="btn btn-primary" style={{ background: 'var(--color-loss)', borderColor: 'var(--color-loss)' }}
                >
                  {deleting ? 'Deleting...' : 'Confirm: Delete My Account'}
                </button>
                <button
                  type="button" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); setDeleteError(null) }}
                  disabled={deleting} className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

// File: apps/web/app/settings/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useTheme } from '@/components/ThemeProvider'

interface UserSettings {
  default_commission_pct: number
  default_card_deposit_pct: number
  default_eft_deposit_pct: number
  default_fx_pct: number
  theme: 'light' | 'dark' | 'system'
}

export default function SettingsPage() {
  const supabase = createClient()
  const { theme: currentTheme, setTheme: setAppTheme } = useTheme()

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading settings...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage your preferences and default fee percentages
            </p>
          </div>
          <Link
            href="/portfolio"
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Back to Portfolio
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-md bg-green-50 dark:bg-green-900/20 p-4">
            <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
        )}

        {/* Fee Defaults Section */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Default Fee Percentages</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            These defaults will be used when adding new transactions. You can still adjust fees for each transaction individually.
          </p>

          <div className="space-y-6">
            {/* Commission Percentage */}
            <div>
              <label htmlFor="commission" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Commission (%)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type="number"
                  id="commission"
                  step="0.01"
                  min="0"
                  max="100"
                  value={settings.default_commission_pct}
                  onChange={(e) => setSettings({ ...settings, default_commission_pct: parseFloat(e.target.value) || 0 })}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 pr-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 dark:text-gray-400 sm:text-sm">%</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Typical value: 0.25% (EasyEquities standard)
              </p>
            </div>

            {/* Card Deposit Percentage */}
            <div>
              <label htmlFor="cardDeposit" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Card Deposit Fee (%)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type="number"
                  id="cardDeposit"
                  step="0.1"
                  min="0"
                  max="100"
                  value={settings.default_card_deposit_pct}
                  onChange={(e) => setSettings({ ...settings, default_card_deposit_pct: parseFloat(e.target.value) || 0 })}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 pr-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 dark:text-gray-400 sm:text-sm">%</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Typical range: 1-2% (varies by card provider)
              </p>
            </div>

            {/* EFT Deposit Percentage */}
            <div>
              <label htmlFor="eftDeposit" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                EFT Deposit Fee (%)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type="number"
                  id="eftDeposit"
                  step="0.1"
                  min="0"
                  max="100"
                  value={settings.default_eft_deposit_pct}
                  onChange={(e) => setSettings({ ...settings, default_eft_deposit_pct: parseFloat(e.target.value) || 0 })}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 pr-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 dark:text-gray-400 sm:text-sm">%</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Typical value: 0% (EFT deposits are usually free)
              </p>
            </div>

            {/* FX Percentage */}
            <div>
              <label htmlFor="fx" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Foreign Exchange Fee (%)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type="number"
                  id="fx"
                  step="0.1"
                  min="0"
                  max="100"
                  value={settings.default_fx_pct}
                  onChange={(e) => setSettings({ ...settings, default_fx_pct: parseFloat(e.target.value) || 0 })}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 pr-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 dark:text-gray-400 sm:text-sm">%</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Typical value: 0.5% (for USD transactions)
              </p>
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Appearance</h2>

          <div>
            <label htmlFor="theme" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Theme
            </label>
            <select
              id="theme"
              value={settings.theme}
              onChange={(e) => {
                const newTheme = e.target.value as 'light' | 'dark' | 'system'
                setSettings({ ...settings, theme: newTheme })
                setAppTheme(newTheme) // Apply theme immediately
              }}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            >
              <option value="system">System (Auto)</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Choose your preferred color theme
            </p>
          </div>
        </div>

        {/* Future Sections Placeholder */}
        {/* Data Import/Export */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Data Management</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Manage Cash Deposits</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Track cash deposited into your accounts to calculate uninvested capital
              </p>
              <Link
                href="/settings/deposits"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Manage Deposits
              </Link>
            </div>
            <div className="border-t dark:border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Import Historical Transactions</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Bulk import your historical positions from a CSV file
              </p>
              <Link
                href="/settings/import"
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Import from CSV
              </Link>
            </div>
            <div className="border-t dark:border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Add Single Historical Position</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Manually add a historical transaction with custom date and price
              </p>
              <Link
                href="/transactions/new/historical"
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Add Historical Position
              </Link>
            </div>
          </div>
        </div>

        {/* Future Features */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6 opacity-50">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Future Features</h2>
          <div className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <h3 className="font-medium mb-1">Notifications (Coming Soon)</h3>
              <p className="text-xs">Email alerts for rebalancing signals and portfolio milestones</p>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <h3 className="font-medium mb-1">Data Export (Coming Soon)</h3>
              <p className="text-xs">Export your portfolio data to CSV format</p>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <h3 className="font-medium mb-1">Account Management (Coming Soon)</h3>
              <p className="text-xs">Manage your connected accounts and data retention preferences</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

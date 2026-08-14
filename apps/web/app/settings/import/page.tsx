// File: apps/web/app/settings/import/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CSVPreviewTable, { type CSVRow } from '@/components/CSVPreviewTable'
import Link from 'next/link'

export default function ImportPage() {
  const router = useRouter()
  const supabase = createClient()

  const [accountType, setAccountType] = useState<'ZAR' | 'USD'>('ZAR')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<CSVRow[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const downloadTemplate = () => {
    const template = `Date,Ticker,Shares,Price,Total_Fees
2024-01-15,ASPEN,100,145.50,36.38
2024-02-20,NPN,50,3200.00,400.00
2024-03-10,SBK,75,185.25,34.80`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'portfolio-import-template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCsvFile(file)
      setParsedRows([])
      setError(null)
      setSuccess(null)
    }
  }

  const parseCSV = async () => {
    if (!csvFile) {
      setError('Please select a CSV file')
      return
    }

    setParsing(true)
    setError(null)

    try {
      const text = await csvFile.text()
      const lines = text.trim().split('\n')

      if (lines.length < 2) {
        throw new Error('CSV file must contain at least a header row and one data row')
      }

      // Parse header
      const header = lines[0].split(',').map(h => h.trim().toLowerCase())
      const dateIdx = header.indexOf('date')
      const tickerIdx = header.indexOf('ticker')
      const sharesIdx = header.indexOf('shares')
      const priceIdx = header.indexOf('price')
      const feesIdx = header.findIndex(h => h.includes('fee'))

      // Validate required columns
      if (dateIdx === -1 || tickerIdx === -1 || sharesIdx === -1 || priceIdx === -1) {
        throw new Error('CSV must contain columns: Date, Ticker, Shares, Price')
      }

      // Parse data rows
      const rows: CSVRow[] = lines.slice(1).map((line, idx) => {
        const cells = line.split(',').map(c => c.trim())
        const errors: string[] = []

        // Parse date
        const dateStr = cells[dateIdx] || ''
        let date = dateStr
        if (!dateStr) {
          errors.push('Date is required')
        } else {
          // Validate date format (YYYY-MM-DD or convert from other formats)
          try {
            const parsed = new Date(dateStr)
            if (isNaN(parsed.getTime())) {
              errors.push('Invalid date format')
            } else {
              date = parsed.toISOString().split('T')[0]
            }
          } catch {
            errors.push('Invalid date format')
          }
        }

        // Parse ticker
        const ticker = (cells[tickerIdx] || '').toUpperCase()
        if (!ticker) {
          errors.push('Ticker is required')
        }

        // Parse shares
        const shares = parseFloat(cells[sharesIdx] || '0')
        if (isNaN(shares) || shares <= 0) {
          errors.push('Shares must be a positive number')
        }

        // Parse price
        const price = parseFloat(cells[priceIdx] || '0')
        if (isNaN(price) || price <= 0) {
          errors.push('Price must be a positive number')
        }

        // Parse fees (optional)
        let totalFees = 0
        if (feesIdx !== -1 && cells[feesIdx]) {
          totalFees = parseFloat(cells[feesIdx])
          if (isNaN(totalFees)) {
            totalFees = 0
          }
        }

        return {
          date,
          ticker,
          shares,
          price,
          totalFees,
          valid: errors.length === 0,
          errors,
        }
      })

      setParsedRows(rows)

      const validCount = rows.filter(r => r.valid).length
      if (validCount === 0) {
        setError('No valid rows found in CSV')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV')
      setParsedRows([])
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    if (parsedRows.length === 0) {
      setError('No rows to import')
      return
    }

    const validRows = parsedRows.filter(r => r.valid)
    if (validRows.length === 0) {
      setError('No valid rows to import. Please fix errors first.')
      return
    }

    setImporting(true)
    setError(null)
    setSuccess(null)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Not authenticated')
      }

      // Prepare transactions for insert
      const transactions = validRows.map(row => ({
        user_id: user.id,
        ticker: row.ticker,
        shares: row.shares,
        price_at_transaction: row.price,
        date: row.date,
        account_type: accountType,
        deposit_method: 'eft' as const, // Default for imports
        commission_fee: 0,
        deposit_fee: 0,
        fx_fee: 0,
        other_fees: row.totalFees, // Put all fees in "other" category
      }))

      // Bulk insert
      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactions)

      if (insertError) throw insertError

      setSuccess(`Successfully imported ${validRows.length} transaction(s)!`)

      // Clear form after success
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import transactions')
    } finally {
      setImporting(false)
    }
  }

  const removeRow = (index: number) => {
    setParsedRows(parsedRows.filter((_, i) => i !== index))
  }

  const validRowsCount = parsedRows.filter(r => r.valid).length

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Import Transactions</h1>
            <p className="mt-2 text-sm text-gray-600">
              Upload a CSV file to bulk import historical transactions
            </p>
          </div>
          <Link
            href="/settings"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Settings
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          {/* Template Download */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium text-blue-900">Need a template?</h3>
                <p className="mt-1 text-sm text-blue-700">
                  Download our CSV template with example data to get started
                </p>
              </div>
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50"
              >
                Download Template
              </button>
            </div>
          </div>

          {/* Account Type Selector */}
          <div>
            <label htmlFor="accountType" className="block text-sm font-medium text-gray-700">
              Target Account
            </label>
            <select
              id="accountType"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as 'ZAR' | 'USD')}
              disabled={importing || parsing}
              className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            >
              <option value="ZAR">ZAR (South African Rand)</option>
              <option value="USD">USD (US Dollar)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              All imported transactions will be added to this account
            </p>
          </div>

          {/* File Upload */}
          <div>
            <label htmlFor="csv-file" className="block text-sm font-medium text-gray-700">
              CSV File
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={importing || parsing}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={parseCSV}
                disabled={!csvFile || parsing || importing}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {parsing ? 'Parsing...' : 'Parse CSV'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Expected columns: Date, Ticker, Shares, Price, Total_Fees (optional)
            </p>
          </div>

          {/* CSV Format Info */}
          <div className="bg-gray-50 rounded-md p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">CSV Format Requirements</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
              <li><strong>Date:</strong> YYYY-MM-DD format (e.g., 2024-01-15)</li>
              <li><strong>Ticker:</strong> JSE ticker symbol without .JO suffix (e.g., ASPEN, NPN)</li>
              <li><strong>Shares:</strong> Number of shares purchased (e.g., 100.5)</li>
              <li><strong>Price:</strong> Price per share in ZAR (e.g., 145.50)</li>
              <li><strong>Total_Fees:</strong> Optional - total fees paid for this transaction (e.g., 36.38)</li>
            </ul>
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Success Display */}
          {success && (
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <>
              <CSVPreviewTable rows={parsedRows} onRemoveRow={removeRow} />

              {/* Import Button */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setParsedRows([])
                    setCsvFile(null)
                    setError(null)
                  }}
                  disabled={importing}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Clear
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || validRowsCount === 0}
                  className="px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? 'Importing...' : `Import ${validRowsCount} Transaction(s)`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

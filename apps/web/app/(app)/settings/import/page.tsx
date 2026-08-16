// File: apps/web/app/settings/import/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CSVPreviewTable, { type CSVRow } from '@/components/CSVPreviewTable'
import { Card } from '@/components/Card'

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
      const headerLine = lines[0]
      if (!headerLine) {
        throw new Error('CSV header row is empty')
      }
      const header = headerLine.split(',').map(h => h.trim().toLowerCase())
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
        let date: string = dateStr
        if (!dateStr) {
          errors.push('Date is required')
        } else {
          // Validate date format (YYYY-MM-DD or convert from other formats)
          try {
            const parsed = new Date(dateStr)
            if (isNaN(parsed.getTime())) {
              errors.push('Invalid date format')
            } else {
              const isoDate = parsed.toISOString().split('T')[0]
              if (isoDate) {
                date = isoDate
              }
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
    <div style={{ maxWidth: 940, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>Upload a CSV file to bulk import historical transactions</p>

      <Card style={{ padding: 'var(--space-6)', gap: 'var(--space-4)' }}>
        {/* Template Download */}
        <Card style={{ borderColor: 'var(--color-accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Need a template?</div>
              <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>Download our CSV template with example data to get started</p>
            </div>
            <button onClick={downloadTemplate} className="btn btn-secondary" style={{ flexShrink: 0 }}>
              Download Template
            </button>
          </div>
        </Card>

        <div className="field">
          <label htmlFor="accountType">Target Account</label>
          <select
            id="accountType" className="input"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as 'ZAR' | 'USD')}
            disabled={importing || parsing}
          >
            <option value="ZAR">ZAR (South African Rand)</option>
            <option value="USD">USD (US Dollar)</option>
          </select>
          <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>All imported transactions will be added to this account</p>
        </div>

        <div className="field">
          <label htmlFor="csv-file">CSV File</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              id="csv-file" type="file" accept=".csv"
              onChange={handleFileChange}
              disabled={importing || parsing}
              style={{ fontSize: 13 }}
            />
            <button onClick={parseCSV} disabled={!csvFile || parsing || importing} className="btn btn-primary" style={{ flexShrink: 0 }}>
              {parsing ? 'Parsing...' : 'Parse CSV'}
            </button>
          </div>
          <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Expected columns: Date, Ticker, Shares, Price, Total_Fees (optional)</p>
        </div>

        <Card style={{ background: 'var(--color-surface)' }}>
          <h5 style={{ marginBottom: 8 }}>CSV Format Requirements</h5>
          <ul style={{ fontSize: 13, margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li><strong>Date:</strong> YYYY-MM-DD format (e.g., 2024-01-15)</li>
            <li><strong>Ticker:</strong> JSE ticker symbol without .JO suffix (e.g., ASPEN, NPN)</li>
            <li><strong>Shares:</strong> Number of shares purchased (e.g., 100.5)</li>
            <li><strong>Price:</strong> Price per share in ZAR (e.g., 145.50)</li>
            <li><strong>Total_Fees:</strong> Optional - total fees paid for this transaction (e.g., 36.38)</li>
          </ul>
        </Card>

        {error && (
          <Card style={{ borderColor: 'var(--color-loss)' }}>
            <p style={{ margin: 0, color: 'var(--color-loss)' }}>{error}</p>
          </Card>
        )}

        {success && (
          <Card style={{ borderColor: 'var(--color-accent)' }}>
            <p style={{ margin: 0, color: 'var(--color-accent-700)' }}>{success}</p>
          </Card>
        )}

        {parsedRows.length > 0 && (
          <>
            <CSVPreviewTable rows={parsedRows} onRemoveRow={removeRow} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button
                onClick={() => { setParsedRows([]); setCsvFile(null); setError(null) }}
                disabled={importing}
                className="btn btn-secondary"
              >
                Clear
              </button>
              <button onClick={handleImport} disabled={importing || validRowsCount === 0} className="btn btn-primary">
                {importing ? 'Importing...' : `Import ${validRowsCount} Transaction(s)`}
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

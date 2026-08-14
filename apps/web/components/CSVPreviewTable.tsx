// File: apps/web/components/CSVPreviewTable.tsx
'use client'

export interface CSVRow {
  date: string
  ticker: string
  shares: number
  price: number
  totalFees: number
  valid: boolean
  errors: string[]
}

interface CSVPreviewTableProps {
  rows: CSVRow[]
  onRemoveRow?: (index: number) => void
}

export default function CSVPreviewTable({ rows, onRemoveRow }: CSVPreviewTableProps) {
  if (rows.length === 0) {
    return null
  }

  const validCount = rows.filter(r => r.valid).length
  const invalidCount = rows.filter(r => !r.valid).length

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4 flex gap-6">
        <div>
          <p className="text-sm font-medium text-gray-600">Total Rows</p>
          <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">Valid</p>
          <p className="text-2xl font-bold text-green-600">{validCount}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">Invalid</p>
          <p className="text-2xl font-bold text-red-600">{invalidCount}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ticker
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Shares
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price (R)
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Fees (R)
              </th>
              {onRemoveRow && (
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row, index) => (
              <tr key={index} className={!row.valid ? 'bg-red-50' : ''}>
                <td className="px-4 py-3 whitespace-nowrap">
                  {row.valid ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Valid
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Invalid
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {row.date || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {row.ticker || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                  {row.shares > 0 ? row.shares.toFixed(6) : '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                  {row.price > 0 ? `R${row.price.toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                  {row.totalFees >= 0 ? `R${row.totalFees.toFixed(2)}` : '-'}
                </td>
                {onRemoveRow && (
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => onRemoveRow(index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.some(r => !r.valid) && (
              <tr>
                <td colSpan={onRemoveRow ? 7 : 6} className="px-4 py-3 bg-red-50">
                  <div className="text-sm">
                    <p className="font-medium text-red-800 mb-2">Validation Errors:</p>
                    <ul className="list-disc list-inside space-y-1 text-red-700">
                      {rows.map((row, idx) =>
                        row.errors.map((err, errIdx) => (
                          <li key={`${idx}-${errIdx}`}>
                            Row {idx + 1}: {err}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

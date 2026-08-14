// File: apps/web/components/FeeBreakdown.tsx
'use client'

import { useState, useEffect } from 'react'

export interface FeeBreakdownData {
  commissionFee: number
  depositFee: number
  fxFee: number
  otherFees: number
  totalFees: number
}

interface UserSettings {
  default_commission_pct: number
  default_card_deposit_pct: number
  default_eft_deposit_pct: number
  default_fx_pct: number
}

interface FeeBreakdownProps {
  investmentAmount: number
  depositMethod: 'card' | 'eft'
  accountType: 'ZAR' | 'USD'
  userSettings: UserSettings
  initialFees?: Partial<FeeBreakdownData>
  onChange: (fees: FeeBreakdownData) => void
  showExpanded?: boolean
}

export default function FeeBreakdown({
  investmentAmount,
  depositMethod,
  accountType,
  userSettings,
  initialFees,
  onChange,
  showExpanded = true,
}: FeeBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(showExpanded)
  const [fees, setFees] = useState<FeeBreakdownData>({
    commissionFee: initialFees?.commissionFee ?? 0,
    depositFee: initialFees?.depositFee ?? 0,
    fxFee: initialFees?.fxFee ?? 0,
    otherFees: initialFees?.otherFees ?? 0,
    totalFees: initialFees?.totalFees ?? 0,
  })
  const [manualOverrides, setManualOverrides] = useState({
    commission: false,
    deposit: false,
    fx: false,
  })

  // Auto-calculate fees when inputs change
  useEffect(() => {
    if (investmentAmount <= 0) {
      const zeroFees = {
        commissionFee: 0,
        depositFee: 0,
        fxFee: 0,
        otherFees: fees.otherFees, // Keep other fees
        totalFees: fees.otherFees,
      }
      setFees(zeroFees)
      onChange(zeroFees)
      return
    }

    const newFees = { ...fees }

    // Calculate commission if not manually overridden
    if (!manualOverrides.commission) {
      newFees.commissionFee = (investmentAmount * userSettings.default_commission_pct) / 100
    }

    // Calculate deposit fee if not manually overridden
    if (!manualOverrides.deposit) {
      const depositPct = depositMethod === 'card'
        ? userSettings.default_card_deposit_pct
        : userSettings.default_eft_deposit_pct
      newFees.depositFee = (investmentAmount * depositPct) / 100
    }

    // Calculate FX fee if not manually overridden
    if (!manualOverrides.fx) {
      // For now, FX fee is 0 for ZAR, will add USD support later
      newFees.fxFee = accountType === 'USD' ? (investmentAmount * userSettings.default_fx_pct) / 100 : 0
    }

    // Calculate total
    newFees.totalFees = newFees.commissionFee + newFees.depositFee + newFees.fxFee + newFees.otherFees

    setFees(newFees)
    onChange(newFees)
  }, [investmentAmount, depositMethod, accountType, userSettings, manualOverrides, fees.otherFees])

  const handleFeeChange = (field: 'commissionFee' | 'depositFee' | 'fxFee' | 'otherFees', value: number) => {
    const newFees = { ...fees, [field]: value }
    newFees.totalFees = newFees.commissionFee + newFees.depositFee + newFees.fxFee + newFees.otherFees

    setFees(newFees)
    onChange(newFees)

    // Mark as manually overridden (except for otherFees which is always manual)
    if (field === 'commissionFee') setManualOverrides({ ...manualOverrides, commission: true })
    if (field === 'depositFee') setManualOverrides({ ...manualOverrides, deposit: true })
    if (field === 'fxFee') setManualOverrides({ ...manualOverrides, fx: true })
  }

  const resetToCalculated = () => {
    setManualOverrides({ commission: false, deposit: false, fx: false })
  }

  return (
    <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
      {/* Header with expand/collapse */}
      <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <h3 className="text-sm font-medium text-gray-900">
          Fee Breakdown
          {manualOverrides.commission || manualOverrides.deposit || manualOverrides.fx ? (
            <span className="ml-2 text-xs text-orange-600">(Manually Adjusted)</span>
          ) : null}
        </h3>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-900">
            Total: R{fees.totalFees.toFixed(2)}
          </span>
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded fee details */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Commission Fee */}
          <div>
            <label htmlFor="commissionFee" className="block text-xs font-medium text-gray-700">
              Commission ({userSettings.default_commission_pct}%)
              {manualOverrides.commission && <span className="ml-1 text-orange-600">*</span>}
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">
                R
              </span>
              <input
                type="number"
                id="commissionFee"
                step="0.01"
                min="0"
                value={fees.commissionFee.toFixed(2)}
                onChange={(e) => handleFeeChange('commissionFee', parseFloat(e.target.value) || 0)}
                className="block w-full pl-7 pr-12 rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Deposit Fee */}
          <div>
            <label htmlFor="depositFee" className="block text-xs font-medium text-gray-700">
              Deposit Fee ({depositMethod === 'card' ? userSettings.default_card_deposit_pct : userSettings.default_eft_deposit_pct}% - {depositMethod.toUpperCase()})
              {manualOverrides.deposit && <span className="ml-1 text-orange-600">*</span>}
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">
                R
              </span>
              <input
                type="number"
                id="depositFee"
                step="0.01"
                min="0"
                value={fees.depositFee.toFixed(2)}
                onChange={(e) => handleFeeChange('depositFee', parseFloat(e.target.value) || 0)}
                className="block w-full pl-7 pr-12 rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          {/* FX Fee */}
          {accountType === 'USD' && (
            <div>
              <label htmlFor="fxFee" className="block text-xs font-medium text-gray-700">
                Foreign Exchange Fee ({userSettings.default_fx_pct}%)
                {manualOverrides.fx && <span className="ml-1 text-orange-600">*</span>}
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">
                  R
                </span>
                <input
                  type="number"
                  id="fxFee"
                  step="0.01"
                  min="0"
                  value={fees.fxFee.toFixed(2)}
                  onChange={(e) => handleFeeChange('fxFee', parseFloat(e.target.value) || 0)}
                  className="block w-full pl-7 pr-12 rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          )}

          {/* Other Fees */}
          <div>
            <label htmlFor="otherFees" className="block text-xs font-medium text-gray-700">
              Other Fees (donations, misc)
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">
                R
              </span>
              <input
                type="number"
                id="otherFees"
                step="0.01"
                min="0"
                value={fees.otherFees.toFixed(2)}
                onChange={(e) => handleFeeChange('otherFees', parseFloat(e.target.value) || 0)}
                className="block w-full pl-7 pr-12 rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Reset button */}
          {(manualOverrides.commission || manualOverrides.deposit || manualOverrides.fx) && (
            <button
              type="button"
              onClick={resetToCalculated}
              className="text-xs text-indigo-600 hover:text-indigo-800"
            >
              Reset to calculated values
            </button>
          )}

          {/* Total Cost Summary */}
          <div className="border-t border-gray-300 pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Investment Amount:</span>
              <span className="font-medium">R{investmentAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Total Fees:</span>
              <span className="font-medium">R{fees.totalFees.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-gray-200">
              <span>Total Cost:</span>
              <span>R{(investmentAmount + fees.totalFees).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

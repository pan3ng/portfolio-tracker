// File: apps/web/components/FeeBreakdown.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/Card'
import { Tooltip } from '@/components/Tooltip'

export interface FeeBreakdownData {
  commissionFee: number
  settlementAdminFee: number
  iplAdminFee: number
  securitiesTransferTaxFee: number
  vatFee: number
  fxFee: number
  otherFees: number
  totalFees: number
}

interface UserSettings {
  default_commission_pct: number
  default_fx_pct: number
}

// Statutory/regulatory rates (JSE settlement authority, FSCA, SARS, VAT) — not user
// configurable yet. See TODO.md "Configurable statutory fee defaults" for making these
// editable per user (and eventually per account) like commission/FX already are.
const SETTLEMENT_ADMIN_PCT = 0.075
const IPL_PCT = 0.0002
const SECURITIES_TRANSFER_TAX_PCT = 0.25
const VAT_PCT = 15 // levied on brokerage-related services (commission, settlement, IPL), not on the transfer tax itself

interface FeeBreakdownProps {
  investmentAmount: number
  accountType: 'ZAR' | 'USD'
  userSettings: UserSettings
  initialFees?: Partial<FeeBreakdownData>
  onChange: (fees: FeeBreakdownData) => void
  showExpanded?: boolean
  hideTotalSummary?: boolean
  transactionType?: 'buy' | 'sell'
}

type FeeField = 'commissionFee' | 'settlementAdminFee' | 'iplAdminFee' | 'securitiesTransferTaxFee' | 'vatFee' | 'fxFee' | 'otherFees'

export default function FeeBreakdown({
  investmentAmount,
  accountType,
  userSettings,
  initialFees,
  onChange,
  showExpanded = true,
  hideTotalSummary = false,
  transactionType = 'buy',
}: FeeBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(showExpanded)
  const [isEditingRates, setIsEditingRates] = useState(false)
  const [fees, setFees] = useState<FeeBreakdownData>({
    commissionFee: initialFees?.commissionFee ?? 0,
    settlementAdminFee: initialFees?.settlementAdminFee ?? 0,
    iplAdminFee: initialFees?.iplAdminFee ?? 0,
    securitiesTransferTaxFee: initialFees?.securitiesTransferTaxFee ?? 0,
    vatFee: initialFees?.vatFee ?? 0,
    fxFee: initialFees?.fxFee ?? 0,
    otherFees: initialFees?.otherFees ?? 0,
    totalFees: initialFees?.totalFees ?? 0,
  })
  // If a stored fee (initialFees, e.g. loading an existing transaction to edit)
  // doesn't match what auto-calc would produce for it, treat it as manually
  // overridden from the start — otherwise the auto-calc effect below runs on
  // mount and silently overwrites a real manual override with a freshly
  // recalculated value before the user ever sees it was different.
  const [manualOverrides, setManualOverrides] = useState(() => {
    if (!initialFees || investmentAmount <= 0) {
      return { commission: false, settlementAdmin: false, iplAdmin: false, securitiesTransferTax: false, vat: false, fx: false }
    }
    const autoCommission = (investmentAmount * userSettings.default_commission_pct) / 100
    const autoSettlementAdmin = (investmentAmount * SETTLEMENT_ADMIN_PCT) / 100
    const autoIplAdmin = (investmentAmount * IPL_PCT) / 100
    const autoStt = transactionType === 'sell' ? 0 : (investmentAmount * SECURITIES_TRANSFER_TAX_PCT) / 100
    const autoVat = ((autoCommission + autoSettlementAdmin + autoIplAdmin) * VAT_PCT) / 100
    const autoFx = accountType === 'USD' ? (investmentAmount * userSettings.default_fx_pct) / 100 : 0
    const differs = (a: number, b: number) => Math.abs(a - b) > 0.005 // half-cent tolerance for rounding

    return {
      commission: differs(initialFees.commissionFee ?? 0, autoCommission),
      settlementAdmin: differs(initialFees.settlementAdminFee ?? 0, autoSettlementAdmin),
      iplAdmin: differs(initialFees.iplAdminFee ?? 0, autoIplAdmin),
      securitiesTransferTax: differs(initialFees.securitiesTransferTaxFee ?? 0, autoStt),
      vat: differs(initialFees.vatFee ?? 0, autoVat),
      fx: differs(initialFees.fxFee ?? 0, autoFx),
    }
  })

  // Auto-calculate fees when inputs change
  useEffect(() => {
    if (investmentAmount <= 0) {
      const zeroFees = {
        commissionFee: 0,
        settlementAdminFee: 0,
        iplAdminFee: 0,
        securitiesTransferTaxFee: 0,
        vatFee: 0,
        fxFee: 0,
        otherFees: fees.otherFees, // Keep other fees
        totalFees: fees.otherFees,
      }
      setFees(zeroFees)
      onChange(zeroFees)
      return
    }

    const newFees = { ...fees }

    if (!manualOverrides.commission) {
      newFees.commissionFee = (investmentAmount * userSettings.default_commission_pct) / 100
    }
    if (!manualOverrides.settlementAdmin) {
      newFees.settlementAdminFee = (investmentAmount * SETTLEMENT_ADMIN_PCT) / 100
    }
    if (!manualOverrides.iplAdmin) {
      newFees.iplAdminFee = (investmentAmount * IPL_PCT) / 100
    }
    if (!manualOverrides.securitiesTransferTax) {
      // SA's Securities Transfer Tax Act charges this on purchases, not sales.
      newFees.securitiesTransferTaxFee = transactionType === 'sell' ? 0 : (investmentAmount * SECURITIES_TRANSFER_TAX_PCT) / 100
    }
    if (!manualOverrides.vat) {
      newFees.vatFee = ((newFees.commissionFee + newFees.settlementAdminFee + newFees.iplAdminFee) * VAT_PCT) / 100
    }
    if (!manualOverrides.fx) {
      // For now, FX fee is 0 for ZAR, will add USD support later
      newFees.fxFee = accountType === 'USD' ? (investmentAmount * userSettings.default_fx_pct) / 100 : 0
    }

    newFees.totalFees = newFees.commissionFee + newFees.settlementAdminFee + newFees.iplAdminFee
      + newFees.securitiesTransferTaxFee + newFees.vatFee + newFees.fxFee + newFees.otherFees

    setFees(newFees)
    onChange(newFees)
  }, [investmentAmount, accountType, userSettings, manualOverrides, fees.otherFees, transactionType])

  const handleFeeChange = (field: FeeField, value: number) => {
    const newFees = { ...fees, [field]: value }
    newFees.totalFees = newFees.commissionFee + newFees.settlementAdminFee + newFees.iplAdminFee
      + newFees.securitiesTransferTaxFee + newFees.vatFee + newFees.fxFee + newFees.otherFees

    setFees(newFees)
    onChange(newFees)

    // Mark as manually overridden (except for otherFees which is always manual)
    if (field === 'commissionFee') setManualOverrides((o) => ({ ...o, commission: true }))
    if (field === 'settlementAdminFee') setManualOverrides((o) => ({ ...o, settlementAdmin: true }))
    if (field === 'iplAdminFee') setManualOverrides((o) => ({ ...o, iplAdmin: true }))
    if (field === 'securitiesTransferTaxFee') setManualOverrides((o) => ({ ...o, securitiesTransferTax: true }))
    if (field === 'vatFee') setManualOverrides((o) => ({ ...o, vat: true }))
    if (field === 'fxFee') setManualOverrides((o) => ({ ...o, fx: true }))
  }

  const resetToCalculated = () => {
    setManualOverrides({ commission: false, settlementAdmin: false, iplAdmin: false, securitiesTransferTax: false, vat: false, fx: false })
  }

  const currencySymbol = accountType === 'USD' ? '$' : 'R'
  const isAdjusted = Object.values(manualOverrides).some(Boolean)

  const FeeRow = ({ label, tooltip, field, show = true }: { label: string; tooltip?: string; field: FeeField; show?: boolean }) => {
    if (!show) return null
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-muted">{tooltip ? <Tooltip content={tooltip}>{label}</Tooltip> : label}</span>
        {isEditingRates ? (
          <input
            type="number" step="0.01" min="0" className="input num" style={{ width: 100, textAlign: 'right' }}
            value={fees[field].toFixed(2)}
            onChange={(e) => handleFeeChange(field, parseFloat(e.target.value) || 0)}
          />
        ) : (
          <span className="num">{currencySymbol}{fees[field].toFixed(2)}</span>
        )}
      </div>
    )
  }

  return (
    <Card style={{ padding: '18px 20px' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', cursor: 'pointer' }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="card-kicker">What the fees are</span>
          {isAdjusted && <span className="text-muted" style={{ fontSize: 11 }}>(edited)</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="num" style={{ fontSize: 13, fontWeight: 500 }}>{currencySymbol}{fees.totalFees.toFixed(2)}</span>
          {isExpanded && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 12 }}
              onClick={(e) => { e.stopPropagation(); setIsEditingRates((v) => !v) }}
            >
              {isEditingRates ? 'Done' : 'Edit rates'}
            </button>
          )}
          <span className="text-muted" style={{ fontSize: 11, transform: isExpanded ? 'rotate(180deg)' : undefined, display: 'inline-block' }}>▼</span>
        </div>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14, fontSize: 13.5 }}>
          <FeeRow label={`Broker commission · ${userSettings.default_commission_pct}%`} field="commissionFee" />
          <FeeRow
            label={`Settlement & administration · ${SETTLEMENT_ADMIN_PCT}%`} field="settlementAdminFee"
            tooltip="Covers electronic settlement of the trade through the settlement authority, plus recovery of the fractional-share administration cost."
          />
          <FeeRow
            label={`Investor protection levy & administration · ${IPL_PCT}%`} field="iplAdminFee"
            tooltip="A mandatory regulator charge on whole shares traded, funding market oversight (e.g. insider trading regulation) — ultimately for investors' benefit."
          />
          <FeeRow label={`VAT · ${VAT_PCT}%`} field="vatFee" tooltip="VAT on the brokerage-related fees above (commission, settlement, IPL) — not charged on the transfer tax." />
          <FeeRow
            label={`Securities transfer tax & admin · ${SECURITIES_TRANSFER_TAX_PCT}%`} field="securitiesTransferTaxFee"
            tooltip="Levied by SARS on the purchase and transfer of listed and unlisted securities."
            show={transactionType === 'buy'}
          />
          <FeeRow label={`Foreign exchange fee · ${userSettings.default_fx_pct}%`} field="fxFee" show={accountType === 'USD'} />
          <FeeRow label="Other fees (donations, misc)" field="otherFees" />

          {isEditingRates && isAdjusted && (
            <button type="button" onClick={resetToCalculated} className="btn btn-ghost" style={{ alignSelf: 'flex-start', fontSize: 12 }}>
              Reset to calculated values
            </button>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 9, borderTop: '1px solid var(--color-divider)', fontWeight: 500 }}>
            <span>Total fees</span>
            <span className="num">{currencySymbol}{fees.totalFees.toFixed(2)}</span>
          </div>

          {!hideTotalSummary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Investment amount</span>
                <span className="num">{currencySymbol}{investmentAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Total fees</span>
                <span className="num">+{currencySymbol}{fees.totalFees.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 15 }}>
                <span>Total cost</span>
                <span className="num">{currencySymbol}{(investmentAmount + fees.totalFees).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

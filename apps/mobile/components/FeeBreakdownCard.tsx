// File: apps/mobile/components/FeeBreakdownCard.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { calculateStatutoryFees, SETTLEMENT_ADMIN_PCT, IPL_PCT, SECURITIES_TRANSFER_TAX_PCT, VAT_PCT, type FeeBreakdownData } from '@portfolio-tracker/api-client'
import { useTheme } from '../lib/ThemeContext'
import { fonts } from '../lib/theme'
import BlueprintCard from './BlueprintCard'

interface FeeBreakdownCardProps {
  investmentAmount: number
  accountType: 'ZAR' | 'USD'
  commissionPct: number
  fxPct: number
  initialFees?: Partial<FeeBreakdownData>
  onChange: (fees: FeeBreakdownData) => void
  hideTotalSummary?: boolean
  transactionType?: 'buy' | 'sell'
}

type FeeField = 'commissionFee' | 'settlementAdminFee' | 'iplAdminFee' | 'securitiesTransferTaxFee' | 'vatFee' | 'fxFee' | 'otherFees'
type OverrideKey = 'commission' | 'settlementAdmin' | 'iplAdmin' | 'securitiesTransferTax' | 'vat' | 'fx'

const FIELD_TO_OVERRIDE: Partial<Record<FeeField, OverrideKey>> = {
  commissionFee: 'commission',
  settlementAdminFee: 'settlementAdmin',
  iplAdminFee: 'iplAdmin',
  securitiesTransferTaxFee: 'securitiesTransferTax',
  vatFee: 'vat',
  fxFee: 'fx',
}

/** Mirrors apps/web/components/FeeBreakdown.tsx — auto-calculated statutory fees, each individually overridable via "Edit rates". */
export default function FeeBreakdownCard({
  investmentAmount, accountType, commissionPct, fxPct, initialFees, onChange, hideTotalSummary, transactionType = 'buy',
}: FeeBreakdownCardProps) {
  const { colors } = useTheme()
  const [isEditingRates, setIsEditingRates] = useState(false)
  const [otherFees, setOtherFees] = useState(initialFees?.otherFees ?? 0)
  const [overrides, setOverrides] = useState<Record<OverrideKey, number | null>>({
    commission: null, settlementAdmin: null, iplAdmin: null, securitiesTransferTax: null, vat: null, fx: null,
  })

  const auto = calculateStatutoryFees(investmentAmount, accountType, commissionPct, fxPct, otherFees, transactionType)
  const fees: FeeBreakdownData = {
    commissionFee: overrides.commission ?? auto.commissionFee,
    settlementAdminFee: overrides.settlementAdmin ?? auto.settlementAdminFee,
    iplAdminFee: overrides.iplAdmin ?? auto.iplAdminFee,
    securitiesTransferTaxFee: overrides.securitiesTransferTax ?? auto.securitiesTransferTaxFee,
    vatFee: overrides.vat ?? auto.vatFee,
    fxFee: overrides.fx ?? auto.fxFee,
    otherFees,
    totalFees: 0,
  }
  fees.totalFees = fees.commissionFee + fees.settlementAdminFee + fees.iplAdminFee
    + fees.securitiesTransferTaxFee + fees.vatFee + fees.fxFee + fees.otherFees

  const isAdjusted = Object.values(overrides).some((v) => v !== null)
  const currencySymbol = accountType === 'USD' ? '$' : 'R'

  useEffect(() => {
    onChange(fees)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fees.commissionFee, fees.settlementAdminFee, fees.iplAdminFee, fees.securitiesTransferTaxFee, fees.vatFee, fees.fxFee, fees.otherFees])

  const handleFieldChange = (field: FeeField, text: string) => {
    const value = parseFloat(text) || 0
    if (field === 'otherFees') {
      setOtherFees(value)
      return
    }
    const key = FIELD_TO_OVERRIDE[field]
    if (key) setOverrides((prev) => ({ ...prev, [key]: value }))
  }

  const resetToCalculated = () => {
    setOverrides({ commission: null, settlementAdmin: null, iplAdmin: null, securitiesTransferTax: null, vat: null, fx: null })
  }

  return (
    <BlueprintCard>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.kicker, { color: colors.accent700 }]}>What the fees add up to</Text>
          {isAdjusted && <Text style={{ color: colors.textMuted, fontSize: 11 }}>(edited)</Text>}
        </View>
        <Pressable onPress={() => setIsEditingRates((v) => !v)}>
          <Text style={{ color: colors.accent700, fontSize: 11.5 }}>{isEditingRates ? 'Done' : 'Edit rates'}</Text>
        </Pressable>
      </View>

      <FeeRow label={`Commission ${commissionPct}%`} field="commissionFee" value={fees.commissionFee} editing={isEditingRates} onChangeText={handleFieldChange} colors={colors} symbol={currencySymbol} />
      <FeeRow label={`Settlement & admin ${SETTLEMENT_ADMIN_PCT}%`} field="settlementAdminFee" value={fees.settlementAdminFee} editing={isEditingRates} onChangeText={handleFieldChange} colors={colors} symbol={currencySymbol} />
      <FeeRow label={`Investor protection levy ${IPL_PCT}%`} field="iplAdminFee" value={fees.iplAdminFee} editing={isEditingRates} onChangeText={handleFieldChange} colors={colors} symbol={currencySymbol} />
      <FeeRow label={`VAT ${VAT_PCT}%`} field="vatFee" value={fees.vatFee} editing={isEditingRates} onChangeText={handleFieldChange} colors={colors} symbol={currencySymbol} />
      {transactionType === 'buy' && (
        <FeeRow label={`Securities transfer tax ${SECURITIES_TRANSFER_TAX_PCT}%`} field="securitiesTransferTaxFee" value={fees.securitiesTransferTaxFee} editing={isEditingRates} onChangeText={handleFieldChange} colors={colors} symbol={currencySymbol} />
      )}
      {accountType === 'USD' && (
        <FeeRow label={`Foreign exchange ${fxPct}%`} field="fxFee" value={fees.fxFee} editing={isEditingRates} onChangeText={handleFieldChange} colors={colors} symbol={currencySymbol} />
      )}
      <FeeRow label="Other fees" field="otherFees" value={fees.otherFees} editing={isEditingRates} onChangeText={handleFieldChange} colors={colors} symbol={currencySymbol} />

      {isEditingRates && isAdjusted && (
        <Pressable onPress={resetToCalculated} style={{ alignSelf: 'flex-start' }}>
          <Text style={{ color: colors.accent700, fontSize: 11.5 }}>Reset to calculated values</Text>
        </Pressable>
      )}

      <View style={[styles.totalRow, { borderTopColor: colors.divider }]}>
        <Text style={{ color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 13.5 }}>Total fees</Text>
        <Text style={{ color: colors.text, fontSize: 13.5 }}>{currencySymbol}{fees.totalFees.toFixed(2)}</Text>
      </View>

      {!hideTotalSummary && (
        <View style={{ gap: 4 }}>
          <View style={styles.summaryRow}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Investment amount</Text>
            <Text style={{ color: colors.text, fontSize: 13 }}>{currencySymbol}{investmentAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Total fees</Text>
            <Text style={{ color: colors.text, fontSize: 13 }}>+{currencySymbol}{fees.totalFees.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={{ color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 15 }}>Total cost</Text>
            <Text style={{ color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 15 }}>{currencySymbol}{(investmentAmount + fees.totalFees).toFixed(2)}</Text>
          </View>
        </View>
      )}
    </BlueprintCard>
  )
}

function FeeRow({
  label, field, value, editing, onChangeText, colors, symbol,
}: {
  label: string
  field: FeeField
  value: number
  editing: boolean
  onChangeText: (field: FeeField, text: string) => void
  colors: { text: string; textMuted: string; divider: string; surface: string }
  symbol: string
}) {
  return (
    <View style={styles.feeRow}>
      <Text style={{ color: colors.textMuted, fontSize: 13, flex: 1 }}>{label}</Text>
      {editing ? (
        <TextInput
          style={[styles.feeInput, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
          value={value.toFixed(2)}
          onChangeText={(t) => onChangeText(field, t)}
          keyboardType="decimal-pad"
        />
      ) : (
        <Text style={{ color: colors.text, fontSize: 13 }}>{symbol}{value.toFixed(2)}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  headerLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  kicker: { fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeInput: { width: 90, borderWidth: 1, padding: 6, fontSize: 13, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 7, borderTopWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
})

/**
 * Statutory/regulatory trade fee rates (JSE settlement authority, FSCA, SARS,
 * VAT) — not user configurable yet. See TODO.md "Configurable statutory fee
 * defaults" for making these editable per user (and eventually per account)
 * like commission/FX already are. Kept here (not duplicated in web's
 * FeeBreakdown component and mobile's transaction form) so both compute the
 * exact same numbers.
 */
export const SETTLEMENT_ADMIN_PCT = 0.075
export const IPL_PCT = 0.0002
export const SECURITIES_TRANSFER_TAX_PCT = 0.25
export const VAT_PCT = 15 // levied on brokerage-related services (commission, settlement, IPL), not on the transfer tax itself

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

/**
 * Auto-calculates the full statutory + commission + FX fee breakdown for a
 * trade. `otherFees` is always manual (there's no statutory formula for it),
 * so callers pass through whatever the user has typed for it.
 *
 * `transactionType` defaults to 'buy' for backward compatibility with every
 * existing call site. Securities Transfer Tax is a purchase-side tax under
 * SA's Securities Transfer Tax Act — brokers (EasyEquities included) charge
 * it on buys, not sells — so a 'sell' zeroes that line out. VAT still applies
 * either way, since it's charged on the brokerage service fee itself
 * (commission/settlement/IPL), not on the trade direction.
 */
export function calculateStatutoryFees(
  investmentAmount: number,
  accountType: 'ZAR' | 'USD',
  commissionPct: number,
  fxPct: number,
  otherFees = 0,
  transactionType: 'buy' | 'sell' = 'buy'
): FeeBreakdownData {
  if (investmentAmount <= 0) {
    return {
      commissionFee: 0, settlementAdminFee: 0, iplAdminFee: 0,
      securitiesTransferTaxFee: 0, vatFee: 0, fxFee: 0,
      otherFees, totalFees: otherFees,
    }
  }

  const commissionFee = (investmentAmount * commissionPct) / 100
  const settlementAdminFee = (investmentAmount * SETTLEMENT_ADMIN_PCT) / 100
  const iplAdminFee = (investmentAmount * IPL_PCT) / 100
  const securitiesTransferTaxFee = transactionType === 'sell' ? 0 : (investmentAmount * SECURITIES_TRANSFER_TAX_PCT) / 100
  const vatFee = ((commissionFee + settlementAdminFee + iplAdminFee) * VAT_PCT) / 100
  // For now, FX fee is 0 for ZAR, will add broader USD support later
  const fxFee = accountType === 'USD' ? (investmentAmount * fxPct) / 100 : 0

  const totalFees = commissionFee + settlementAdminFee + iplAdminFee + securitiesTransferTaxFee + vatFee + fxFee + otherFees

  return { commissionFee, settlementAdminFee, iplAdminFee, securitiesTransferTaxFee, vatFee, fxFee, otherFees, totalFees }
}

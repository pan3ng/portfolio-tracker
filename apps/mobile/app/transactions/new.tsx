// File: apps/mobile/app/transactions/new.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter, useLocalSearchParams } from 'expo-router'
import {
  fetchQuote,
  getTickerName,
  searchJSETickers,
  calculateTickerPosition,
  type Quote,
  type FeeBreakdownData,
} from '@portfolio-tracker/api-client'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/ThemeContext'
import { fonts } from '../../lib/theme'
import BlueprintCard from '../../components/BlueprintCard'
import FeeBreakdownCard from '../../components/FeeBreakdownCard'
import Segmented from '../../components/Segmented'
import Button from '../../components/Button'

const EMPTY_FEES: FeeBreakdownData = {
  commissionFee: 0, settlementAdminFee: 0, iplAdminFee: 0, securitiesTransferTaxFee: 0,
  vatFee: 0, fxFee: 0, otherFees: 0, totalFees: 0,
}

type AccountType = 'ZAR' | 'USD'
type TxKind = 'buy' | 'sell' | 'deposit' | 'withdrawal'
type DepositMethod = 'card' | 'eft'

interface HeldPosition {
  ticker: string
  shares: number
  avgCostPerShare: number
  accountType: AccountType
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0] as string
}

export default function NewTransactionScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const params = useLocalSearchParams<{ ticker?: string; kind?: string }>()

  const initialKind: TxKind =
    params.kind === 'deposit' || params.kind === 'withdrawal' || params.kind === 'sell' ? params.kind : 'buy'
  const [kind, setKind] = useState<TxKind>(initialKind)
  const [accountType, setAccountType] = useState<AccountType>('ZAR')

  // Buy/Sell fields
  const [ticker, setTicker] = useState(params.ticker?.toUpperCase() || '')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [fees, setFees] = useState<FeeBreakdownData>(EMPTY_FEES)

  // Sell-only fields
  const [heldPositions, setHeldPositions] = useState<HeldPosition[]>([])
  const [loadingPositions, setLoadingPositions] = useState(false)
  const [sellShares, setSellShares] = useState('')

  // Deposit/Withdrawal fields
  const [movementAmount, setMovementAmount] = useState('')
  const [movementDate, setMovementDate] = useState(todayIso())
  const [depositMethod, setDepositMethod] = useState<DepositMethod>('card')
  const [movementFee, setMovementFee] = useState(0)
  const [feeManuallySet, setFeeManuallySet] = useState(false)
  const [description, setDescription] = useState('')

  const [commissionPct, setCommissionPct] = useState(0.25)
  const [fxPct, setFxPct] = useState(0.5)
  const [cardPct, setCardPct] = useState(2.0)
  const [eftPct, setEftPct] = useState(0.0)

  const [fetchingQuote, setFetchingQuote] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()
      if (data) {
        setCommissionPct(data.default_commission_pct)
        setFxPct(data.default_fx_pct)
        setCardPct(data.default_card_deposit_pct)
        setEftPct(data.default_eft_deposit_pct)
      }
    })
  }, [])

  useEffect(() => {
    if (kind !== 'deposit' || feeManuallySet) return
    const amountNum = parseFloat(movementAmount) || 0
    const pct = depositMethod === 'card' ? cardPct : eftPct
    setMovementFee((amountNum * pct) / 100)
  }, [kind, movementAmount, depositMethod, cardPct, eftPct, feeManuallySet])

  useEffect(() => {
    if (kind === 'sell' && heldPositions.length === 0 && !loadingPositions) {
      loadHeldPositions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  const loadHeldPositions = async () => {
    setLoadingPositions(true)
    try {
      const { data, error: fetchError } = await supabase.from('transactions').select('*')
      if (fetchError) throw fetchError

      const byTicker = new Map<string, any[]>()
      ;(data || []).forEach((tx: any) => {
        if (!byTicker.has(tx.ticker)) byTicker.set(tx.ticker, [])
        byTicker.get(tx.ticker)!.push(tx)
      })

      const positions: HeldPosition[] = []
      byTicker.forEach((txs, tickerSymbol) => {
        const position = calculateTickerPosition(txs)
        if (position.shares > 0.000001) {
          positions.push({
            ticker: tickerSymbol,
            shares: position.shares,
            avgCostPerShare: position.avgCostPerShare,
            accountType: (position.accountType as AccountType) || 'ZAR',
          })
        }
      })
      positions.sort((a, b) => a.ticker.localeCompare(b.ticker))
      setHeldPositions(positions)

      if (params.ticker) {
        const match = positions.find((p) => p.ticker === params.ticker?.toUpperCase())
        if (match) setAccountType(match.accountType)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your holdings')
    } finally {
      setLoadingPositions(false)
    }
  }

  const handleFetchQuote = async () => {
    const trimmed = ticker.trim().toUpperCase()
    if (!trimmed) {
      setError('Please enter a ticker')
      return
    }
    setFetchingQuote(true)
    setError(null)
    try {
      const q = await fetchQuote(supabase, trimmed)
      setQuote(q)
      setTicker(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch quote')
      setQuote(null)
    } finally {
      setFetchingQuote(false)
    }
  }

  const investmentAmount = parseFloat(amount) || 0
  const shares = quote && investmentAmount > 0 ? investmentAmount / quote.price_zar : 0
  const totalToPay = investmentAmount + fees.totalFees
  const currencySymbol = accountType === 'USD' ? '$' : 'R'
  const tickerName = ticker ? getTickerName(ticker) : undefined
  const suggestions = showSuggestions && ticker.trim() ? searchJSETickers(ticker).slice(0, 6) : []

  const handleSaveBuy = async () => {
    if (!quote || shares <= 0) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)

    const { error: insertError } = await supabase.from('transactions').insert({
      user_id: user.id,
      ticker,
      date: new Date().toISOString(),
      shares,
      price_at_transaction: quote.price_zar,
      account_type: accountType,
      transaction_type: 'buy',
      commission_fee: fees.commissionFee,
      settlement_admin_fee: fees.settlementAdminFee,
      ipl_admin_fee: fees.iplAdminFee,
      securities_transfer_tax_fee: fees.securitiesTransferTaxFee,
      vat_fee: fees.vatFee,
      fx_fee: fees.fxFee,
      other_fees: fees.otherFees,
      total_fees: fees.totalFees,
      notes: notes.trim() || null,
      tags: tags.length > 0 ? tags : null,
    })
    if (insertError) throw insertError
  }

  const handleSaveSell = async () => {
    const heldPosition = heldPositions.find((p) => p.ticker === ticker)
    if (!heldPosition) throw new Error('Select a holding to sell')
    if (!quote) throw new Error('Please fetch a quote first')

    const sharesNum = parseFloat(sellShares)
    if (isNaN(sharesNum) || sharesNum <= 0) throw new Error('Please enter a valid number of shares')
    if (sharesNum > heldPosition.shares) throw new Error(`You only hold ${heldPosition.shares.toFixed(6)} shares`)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)

    const { error: insertError } = await supabase.from('transactions').insert({
      user_id: user.id,
      ticker,
      date: new Date().toISOString(),
      shares: sharesNum,
      price_at_transaction: quote.price_zar,
      account_type: heldPosition.accountType,
      transaction_type: 'sell',
      commission_fee: fees.commissionFee,
      settlement_admin_fee: fees.settlementAdminFee,
      ipl_admin_fee: fees.iplAdminFee,
      securities_transfer_tax_fee: fees.securitiesTransferTaxFee,
      vat_fee: fees.vatFee,
      fx_fee: fees.fxFee,
      other_fees: fees.otherFees,
      total_fees: fees.totalFees,
      notes: notes.trim() || null,
      tags: tags.length > 0 ? tags : null,
    })
    if (insertError) throw insertError
  }

  const handleSaveMovement = async () => {
    const amountNum = parseFloat(movementAmount)
    if (isNaN(amountNum) || amountNum <= 0) throw new Error('Please enter a valid amount')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(movementDate)) throw new Error('Date must be in YYYY-MM-DD format')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error: insertError } = await supabase.from('deposits').insert({
      user_id: user.id,
      amount: amountNum,
      date: new Date(movementDate).toISOString(),
      account_type: accountType,
      movement_type: kind === 'withdrawal' ? 'withdrawal' : 'deposit',
      deposit_method: depositMethod,
      deposit_fee: movementFee,
      description: description.trim() || null,
    })
    if (insertError) throw insertError
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      if (kind === 'buy') {
        await handleSaveBuy()
      } else if (kind === 'sell') {
        await handleSaveSell()
      } else if (kind === 'deposit' || kind === 'withdrawal') {
        await handleSaveMovement()
      }
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const canSave = kind === 'buy' ? !!quote && !!amount : kind === 'sell' ? !!quote && !!sellShares : !!movementAmount

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <View style={styles.headerTop}>
          <Text style={{ color: colors.accent700, fontSize: 12.5 }} onPress={() => router.back()}>Cancel</Text>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.heading }]}>Add Transaction</Text>
          <Text style={{ fontSize: 12.5, opacity: 0 }}>—</Text>
        </View>
        <Segmented
          block
          size="md"
          options={[
            { value: 'buy', label: 'Buy' },
            { value: 'sell', label: 'Sell' },
            { value: 'deposit', label: 'Deposit' },
            { value: 'withdrawal', label: 'Withdrawal' },
          ]}
          value={kind}
          onChange={(v) => setKind(v as TxKind)}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {kind === 'buy' && (
          <>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>What did you buy?</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1, borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
                  value={ticker}
                  onChangeText={(v) => { setTicker(v.toUpperCase()); setQuote(null); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="e.g. STXNDQ"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  editable={!saving}
                />
                <Button label={fetchingQuote ? '' : 'Get Quote'} loading={fetchingQuote} onPress={handleFetchQuote} disabled={saving} variant="primary" />
              </View>
              {tickerName && <Text style={{ color: colors.textMuted, fontSize: 12 }}>{tickerName}</Text>}

              {suggestions.length > 0 && (
                <View style={[styles.suggestions, { borderColor: colors.divider, backgroundColor: colors.surface }]}>
                  {suggestions.map((s) => (
                    <Pressable
                      key={s.symbol}
                      style={[styles.suggestionRow, { borderBottomColor: colors.divider }]}
                      onPress={() => { setTicker(s.symbol); setShowSuggestions(false); setQuote(null) }}
                    >
                      <Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 14 }}>{s.symbol}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{s.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {quote && (
              <View style={[styles.quoteCard, { borderColor: colors.accent, backgroundColor: colors.surface }]}>
                <View>
                  <Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 16 }}>{quote.ticker}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>{tickerName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 22 }}>R {quote.price_zar.toFixed(2)}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>per share</Text>
                </View>
              </View>
            )}

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Amount to invest ({accountType})</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder={`${currencySymbol} 1000.00`}
                placeholderTextColor={colors.textMuted}
                editable={!saving && !!quote}
              />
              {!quote && <Text style={{ color: colors.textMuted, fontSize: 12 }}>Please fetch a quote first</Text>}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Account</Text>
              <Segmented block size="md" options={[{ value: 'ZAR', label: 'ZAR' }, { value: 'USD', label: 'USD' }]} value={accountType} onChange={(v) => setAccountType(v as AccountType)} />
            </View>

            {investmentAmount > 0 && (
              <FeeBreakdownCard
                investmentAmount={investmentAmount}
                accountType={accountType}
                commissionPct={commissionPct}
                fxPct={fxPct}
                onChange={setFees}
                hideTotalSummary
              />
            )}

            {quote && amount && shares > 0 && (
              <BlueprintCard wash>
                <Text style={[styles.kicker, { color: colors.accent700 }]}>You'll pay</Text>
                <Text style={[styles.totalValue, { color: colors.text, fontFamily: fonts.heading }]}>{currencySymbol}{totalToPay.toFixed(2)}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12.5 }}>{shares.toFixed(6)} shares, plus {currencySymbol}{fees.totalFees.toFixed(2)} in fees</Text>
              </BlueprintCard>
            )}

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top', borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="e.g., Monthly contribution"
                placeholderTextColor={colors.textMuted}
                editable={!saving}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Tags (comma separated)</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
                value={tagsInput}
                onChangeText={setTagsInput}
                placeholder="e.g., core, monthly"
                placeholderTextColor={colors.textMuted}
                editable={!saving}
              />
            </View>
          </>
        )}

        {kind === 'sell' && (() => {
          const heldPosition = heldPositions.find((p) => p.ticker === ticker)
          const sellSharesNum = parseFloat(sellShares) || 0
          const grossProceeds = quote && sellSharesNum > 0 ? sellSharesNum * quote.price_zar : 0
          const netProceeds = grossProceeds - fees.totalFees
          const costBasisRemoved = heldPosition ? heldPosition.avgCostPerShare * sellSharesNum : 0
          const realizedGain = grossProceeds > 0 ? netProceeds - costBasisRemoved : 0

          return (
            <>
              {loadingPositions ? (
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Loading your holdings...</Text>
              ) : heldPositions.length === 0 ? (
                <BlueprintCard dashed>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>You don't hold anything to sell yet.</Text>
                </BlueprintCard>
              ) : (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.text }]}>Which holding?</Text>
                    <View style={[styles.suggestions, { borderColor: colors.divider, backgroundColor: colors.surface }]}>
                      {heldPositions.map((p) => (
                        <Pressable
                          key={p.ticker}
                          style={[
                            styles.suggestionRow,
                            { borderBottomColor: colors.divider },
                            ticker === p.ticker && { backgroundColor: colors.accentWash },
                          ]}
                          onPress={() => { setTicker(p.ticker); setQuote(null); setSellShares(''); setAccountType(p.accountType) }}
                        >
                          <Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 14 }}>{p.ticker}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{p.shares.toFixed(6)} shares ({p.accountType})</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {heldPosition && (
                    <>
                      <Button label={fetchingQuote ? '' : 'Get Quote'} loading={fetchingQuote} onPress={handleFetchQuote} disabled={saving} variant="primary" />

                      {quote && (
                        <View style={[styles.quoteCard, { borderColor: colors.accent, backgroundColor: colors.surface }]}>
                          <View>
                            <Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 16 }}>{quote.ticker}</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>Fetched {new Date(quote.fetched_at).toLocaleTimeString()}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 22 }}>R {quote.price_zar.toFixed(2)}</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>per share</Text>
                          </View>
                        </View>
                      )}

                      <View style={styles.field}>
                        <Text style={[styles.label, { color: colors.text }]}>Shares to sell (you hold {heldPosition.shares.toFixed(6)})</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TextInput
                            style={[styles.input, { flex: 1, borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
                            value={sellShares}
                            onChangeText={setSellShares}
                            keyboardType="decimal-pad"
                            placeholder="0.000000"
                            placeholderTextColor={colors.textMuted}
                            editable={!saving && !!quote}
                          />
                          <Button label="Sell all" variant="secondary" onPress={() => setSellShares(heldPosition.shares.toString())} disabled={!quote || saving} />
                        </View>
                        {!quote && <Text style={{ color: colors.textMuted, fontSize: 12 }}>Please fetch a quote first</Text>}
                      </View>

                      {grossProceeds > 0 && (
                        <FeeBreakdownCard
                          investmentAmount={grossProceeds}
                          accountType={accountType}
                          commissionPct={commissionPct}
                          fxPct={fxPct}
                          onChange={setFees}
                          hideTotalSummary
                          transactionType="sell"
                        />
                      )}

                      {grossProceeds > 0 && (
                        <BlueprintCard wash>
                          <Text style={[styles.kicker, { color: colors.accent700 }]}>You'll receive</Text>
                          <Text style={[styles.totalValue, { color: colors.text, fontFamily: fonts.heading }]}>{currencySymbol}{netProceeds.toFixed(2)}</Text>
                          <Text style={{ color: realizedGain >= 0 ? colors.gain : colors.loss, fontSize: 13, fontFamily: fonts.bodyMedium }}>
                            Realized {realizedGain >= 0 ? 'gain' : 'loss'}: {realizedGain >= 0 ? '+' : ''}{currencySymbol}{realizedGain.toFixed(2)}
                          </Text>
                        </BlueprintCard>
                      )}

                      <View style={styles.field}>
                        <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
                        <TextInput
                          style={[styles.input, { height: 70, textAlignVertical: 'top', borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
                          value={notes}
                          onChangeText={setNotes}
                          multiline
                          placeholder="e.g., Rebalancing, taking profit"
                          placeholderTextColor={colors.textMuted}
                          editable={!saving}
                        />
                      </View>

                      <View style={styles.field}>
                        <Text style={[styles.label, { color: colors.text }]}>Tags (comma separated)</Text>
                        <TextInput
                          style={[styles.input, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
                          value={tagsInput}
                          onChangeText={setTagsInput}
                          placeholder="e.g., core, monthly"
                          placeholderTextColor={colors.textMuted}
                          editable={!saving}
                        />
                      </View>
                    </>
                  )}
                </>
              )}
            </>
          )
        })()}

        {(kind === 'deposit' || kind === 'withdrawal') && (
          <>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Amount ({accountType})</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
                value={movementAmount}
                onChangeText={setMovementAmount}
                keyboardType="decimal-pad"
                placeholder={`${currencySymbol} 1000.00`}
                placeholderTextColor={colors.textMuted}
                editable={!saving}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Date</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
                value={movementDate}
                onChangeText={setMovementDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                editable={!saving}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Account</Text>
              <Segmented block size="md" options={[{ value: 'ZAR', label: 'ZAR' }, { value: 'USD', label: 'USD' }]} value={accountType} onChange={(v) => setAccountType(v as AccountType)} />
            </View>

            {kind === 'deposit' && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>Deposit method</Text>
                <Segmented
                  block size="md"
                  options={[{ value: 'card', label: 'Card' }, { value: 'eft', label: 'EFT' }]}
                  value={depositMethod}
                  onChange={(v) => { setDepositMethod(v as DepositMethod); setFeeManuallySet(false) }}
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>{kind === 'deposit' ? 'Deposit fee' : 'Withdrawal fee'} ({currencySymbol})</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
                value={movementFee.toFixed(2)}
                onChangeText={(v) => { setFeeManuallySet(true); setMovementFee(parseFloat(v) || 0) }}
                keyboardType="decimal-pad"
                editable={!saving}
              />
              {kind === 'deposit' && (
                <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>
                  Auto-calculated at {depositMethod === 'card' ? cardPct : eftPct}% ({depositMethod}). Edit to override.
                </Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Description</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
                value={description}
                onChangeText={setDescription}
                placeholder={kind === 'deposit' ? 'e.g., Monthly transfer' : 'e.g., Cash needed elsewhere'}
                placeholderTextColor={colors.textMuted}
                editable={!saving}
              />
            </View>
          </>
        )}

        {error && <Text style={{ color: colors.loss, fontSize: 13 }}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        <Button label="Cancel" variant="secondary" onPress={() => router.back()} disabled={saving} style={{ flex: 1 }} />
        <Button
          label={kind === 'buy' ? 'Save transaction' : kind === 'sell' ? 'Save this sale' : kind === 'deposit' ? 'Save deposit' : 'Save withdrawal'}
          variant="primary"
          onPress={handleSave}
          disabled={!canSave || saving}
          loading={saving}
          style={{ flex: 2 }}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 18, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 19, letterSpacing: 0.3, marginLeft: 'auto', marginRight: 'auto' },
  scroll: { padding: 18, gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, padding: 12, fontSize: 15 },
  suggestions: { borderWidth: 1 },
  suggestionRow: { padding: 10, borderBottomWidth: 1 },
  quoteCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, padding: 14 },
  kicker: { fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  totalValue: { fontSize: 28, letterSpacing: -0.3 },
  footer: { padding: 14, borderTopWidth: 1, flexDirection: 'row', gap: 10 },
})

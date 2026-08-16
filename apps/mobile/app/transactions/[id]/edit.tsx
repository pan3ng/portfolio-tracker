// File: apps/mobile/app/transactions/[id]/edit.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter, useLocalSearchParams } from 'expo-router'
import { fetchQuote, getTickerName, searchJSETickers, type Quote, type FeeBreakdownData } from '@portfolio-tracker/api-client'
import { supabase } from '../../../lib/supabase'
import { useTheme } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/theme'
import BlueprintCard from '../../../components/BlueprintCard'
import FeeBreakdownCard from '../../../components/FeeBreakdownCard'
import Segmented from '../../../components/Segmented'
import Button from '../../../components/Button'

type AccountType = 'ZAR' | 'USD'

const EMPTY_FEES: FeeBreakdownData = {
  commissionFee: 0, settlementAdminFee: 0, iplAdminFee: 0, securitiesTransferTaxFee: 0,
  vatFee: 0, fxFee: 0, otherFees: 0, totalFees: 0,
}

export default function EditTransactionScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [ticker, setTicker] = useState('')
  const [transactionType, setTransactionType] = useState<'buy' | 'sell'>('buy')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [amount, setAmount] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('ZAR')
  const [notes, setNotes] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [fees, setFees] = useState<FeeBreakdownData>(EMPTY_FEES)
  const [initialFees, setInitialFees] = useState<Partial<FeeBreakdownData>>({})

  const [originalPrice, setOriginalPrice] = useState(0)
  const [originalShares, setOriginalShares] = useState(0)

  const [commissionPct, setCommissionPct] = useState(0.25)
  const [fxPct, setFxPct] = useState(0.5)

  const [loadingTx, setLoadingTx] = useState(true)
  const [fetchingQuote, setFetchingQuote] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()
      if (data) {
        setCommissionPct(data.default_commission_pct)
        setFxPct(data.default_fx_pct)
      }
    })
  }, [])

  useEffect(() => {
    if (!id) return
    supabase.from('transactions').select('*').eq('id', id).single().then(({ data, error: fetchError }) => {
      if (fetchError || !data) {
        setError(fetchError?.message || 'Transaction not found')
        setLoadingTx(false)
        return
      }
      setTicker(data.ticker)
      setTransactionType(data.transaction_type === 'sell' ? 'sell' : 'buy')
      setOriginalPrice(data.price_at_transaction)
      setOriginalShares(data.shares)
      setAmount((data.shares * data.price_at_transaction).toFixed(2))
      setAccountType((data.account_type || 'ZAR') as AccountType)
      setNotes(data.notes || '')
      setTagsInput((data.tags || []).join(', '))
      setInitialFees({
        commissionFee: data.commission_fee || 0,
        settlementAdminFee: data.settlement_admin_fee || 0,
        iplAdminFee: data.ipl_admin_fee || 0,
        securitiesTransferTaxFee: data.securities_transfer_tax_fee || 0,
        vatFee: data.vat_fee || 0,
        fxFee: data.fx_fee || 0,
        otherFees: data.other_fees || 0,
      })
      setQuote({ ticker: data.ticker, price_zar: data.price_at_transaction, fetched_at: data.date })
      setLoadingTx(false)
    })
  }, [id])

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
  const currencySymbol = accountType === 'USD' ? '$' : 'R'
  const tickerName = ticker ? getTickerName(ticker) : undefined
  const suggestions = showSuggestions && ticker.trim() ? searchJSETickers(ticker).slice(0, 6) : []

  const handleSave = async () => {
    if (!quote || shares <= 0) return
    setSaving(true)
    setError(null)
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)

      const { error: updateError } = await supabase.from('transactions').update({
        ticker,
        shares,
        price_at_transaction: quote.price_zar,
        account_type: accountType,
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
      }).eq('id', id)
      if (updateError) throw updateError

      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update transaction')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      const { error: deleteError } = await supabase.from('transactions').delete().eq('id', id)
      if (deleteError) throw deleteError
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transaction')
      setDeleting(false)
    }
  }

  if (loadingTx) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <Text style={{ color: colors.accent700, fontSize: 12.5 }} onPress={() => router.back()}>Cancel</Text>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.heading }]}>
          Edit {transactionType === 'sell' ? 'Sale' : 'Transaction'}
        </Text>
        <Text style={{ fontSize: 12.5, opacity: 0 }}>—</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Account</Text>
          <Segmented block size="md" options={[{ value: 'ZAR', label: 'ZAR' }, { value: 'USD', label: 'USD' }]} value={accountType} onChange={(v) => setAccountType(v as AccountType)} />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Ticker</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1, borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
              value={ticker}
              onChangeText={(v) => { setTicker(v.toUpperCase()); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              autoCapitalize="characters"
              editable={!saving && !deleting}
            />
            <Button label={fetchingQuote ? '' : 'Get Quote'} loading={fetchingQuote} onPress={handleFetchQuote} disabled={saving || deleting} variant="primary" />
          </View>
          {tickerName && <Text style={{ color: colors.textMuted, fontSize: 12 }}>{tickerName}</Text>}

          {suggestions.length > 0 && (
            <View style={[styles.suggestions, { borderColor: colors.divider, backgroundColor: colors.surface }]}>
              {suggestions.map((s) => (
                <Pressable
                  key={s.symbol}
                  style={[styles.suggestionRow, { borderBottomColor: colors.divider }]}
                  onPress={() => { setTicker(s.symbol); setShowSuggestions(false) }}
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
              <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>Price from {new Date(quote.fetched_at).toLocaleString()}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 22 }}>R {quote.price_zar.toFixed(2)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>per share</Text>
            </View>
          </View>
        )}

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>{transactionType === 'sell' ? 'Amount received' : 'Amount to invest'} ({accountType})</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={`${currencySymbol} 1000.00`}
            placeholderTextColor={colors.textMuted}
            editable={!saving && !deleting && !!quote}
          />
        </View>

        {quote && amount && shares > 0 && (
          <BlueprintCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 13 }}>{transactionType === 'sell' ? 'Shares sold' : 'Shares to purchase'}</Text>
              <Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 18 }}>{shares.toFixed(6)}</Text>
            </View>
            {shares !== originalShares && (
              <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>
                Original: {originalShares.toFixed(6)} shares at R {originalPrice.toFixed(2)}
              </Text>
            )}
          </BlueprintCard>
        )}

        {investmentAmount > 0 && (
          <FeeBreakdownCard
            investmentAmount={investmentAmount}
            accountType={accountType}
            commissionPct={commissionPct}
            fxPct={fxPct}
            initialFees={initialFees}
            onChange={setFees}
            transactionType={transactionType}
          />
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
            editable={!saving && !deleting}
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
            editable={!saving && !deleting}
          />
        </View>

        {error && <Text style={{ color: colors.loss, fontSize: 13 }}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        <Button label="Cancel" variant="secondary" onPress={() => router.back()} disabled={saving || deleting} style={{ flex: 1 }} />
        <Button label={deleting ? '' : 'Delete'} loading={deleting} variant="secondary" onPress={handleDelete} disabled={saving || deleting} style={{ flex: 1, borderColor: colors.loss }} />
        <Button
          label="Save"
          variant="primary"
          onPress={handleSave}
          disabled={!quote || !amount || saving || deleting}
          loading={saving}
          style={{ flex: 1 }}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 19, letterSpacing: 0.3, marginLeft: 'auto', marginRight: 'auto' },
  scroll: { padding: 18, gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, padding: 12, fontSize: 15 },
  suggestions: { borderWidth: 1 },
  suggestionRow: { padding: 10, borderBottomWidth: 1 },
  quoteCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, padding: 14 },
  footer: { padding: 14, borderTopWidth: 1, flexDirection: 'row', gap: 10 },
})

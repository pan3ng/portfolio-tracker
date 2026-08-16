// File: apps/mobile/app/transactions/new.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter, useLocalSearchParams } from 'expo-router'
import {
  fetchQuote,
  getTickerName,
  searchJSETickers,
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
type TxKind = 'buy' | 'sell' | 'deposit'

export default function NewTransactionScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const params = useLocalSearchParams<{ ticker?: string }>()

  const [kind, setKind] = useState<TxKind>('buy')
  const [accountType, setAccountType] = useState<AccountType>('ZAR')
  const [ticker, setTicker] = useState(params.ticker?.toUpperCase() || '')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [fees, setFees] = useState<FeeBreakdownData>(EMPTY_FEES)

  const [commissionPct, setCommissionPct] = useState(0.25)
  const [fxPct, setFxPct] = useState(0.5)

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
      }
    })
  }, [])

  useEffect(() => {
    if (kind === 'deposit') router.replace('/deposits/new')
  }, [kind])

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

  const handleSave = async () => {
    if (!quote || shares <= 0) return
    setSaving(true)
    setError(null)
    try {
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

      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <View style={styles.headerTop}>
          <Text style={{ color: colors.accent700, fontSize: 12.5 }} onPress={() => router.back()}>Cancel</Text>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.heading }]}>Add a Transaction</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12.5, opacity: 0.4 }}>Historical</Text>
        </View>
        <Segmented
          block
          size="md"
          options={[
            { value: 'buy', label: 'Buy' },
            { value: 'sell', label: 'Sell' },
            { value: 'deposit', label: 'Deposit' },
          ]}
          value={kind}
          onChange={(v) => setKind(v as TxKind)}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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

        {error && <Text style={{ color: colors.loss, fontSize: 13 }}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        <Button label="Cancel" variant="secondary" onPress={() => router.back()} disabled={saving} style={{ flex: 1 }} />
        <Button
          label="Save transaction"
          variant="primary"
          onPress={handleSave}
          disabled={!quote || !amount || saving}
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

// File: apps/mobile/app/transactions/new.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'
import {
  fetchQuote,
  getTickerName,
  searchJSETickers,
  calculateStatutoryFees,
  type Quote,
  type FeeBreakdownData,
} from '@portfolio-tracker/api-client'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

type AccountType = 'ZAR' | 'USD'

export default function NewTransactionScreen() {
  const router = useRouter()

  const [accountType, setAccountType] = useState<AccountType>('ZAR')
  const [ticker, setTicker] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [tagsInput, setTagsInput] = useState('')

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
  const fees: FeeBreakdownData = calculateStatutoryFees(investmentAmount, accountType, commissionPct, fxPct)
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
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Add Transaction' }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.segRow}>
          {(['ZAR', 'USD'] as AccountType[]).map((opt) => (
            <Pressable
              key={opt}
              style={[styles.segOpt, accountType === opt && styles.segOptActive]}
              onPress={() => setAccountType(opt)}
            >
              <Text style={[styles.segOptText, accountType === opt && styles.segOptTextActive]}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>What did you buy?</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={ticker}
              onChangeText={(v) => { setTicker(v.toUpperCase()); setQuote(null); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="e.g. STXNDQ"
              autoCapitalize="characters"
              editable={!saving}
            />
            <Pressable style={styles.primaryBtn} onPress={handleFetchQuote} disabled={fetchingQuote || saving}>
              {fetchingQuote ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Get Quote</Text>}
            </Pressable>
          </View>
          {tickerName && <Text style={styles.muted}>{tickerName}</Text>}

          {suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((s) => (
                <Pressable
                  key={s.symbol}
                  style={styles.suggestionRow}
                  onPress={() => { setTicker(s.symbol); setShowSuggestions(false); setQuote(null) }}
                >
                  <Text style={styles.suggestionSymbol}>{s.symbol}</Text>
                  <Text style={styles.muted}>{s.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {quote && (
          <View style={styles.quoteCard}>
            <View>
              <Text style={styles.ticker}>{quote.ticker}</Text>
              <Text style={styles.muted}>Fetched {new Date(quote.fetched_at).toLocaleTimeString()}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.quotePrice}>R{quote.price_zar.toFixed(2)}</Text>
              <Text style={styles.muted}>per share</Text>
            </View>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Amount to invest ({accountType})</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={`${currencySymbol} 1000.00`}
            editable={!saving && !!quote}
          />
          {!quote && <Text style={styles.muted}>Please fetch a quote first</Text>}
        </View>

        {investmentAmount > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Fees ({currencySymbol}{fees.totalFees.toFixed(2)})</Text>
            <FeeLine label={`Broker commission · ${commissionPct}%`} value={fees.commissionFee} symbol={currencySymbol} />
            <FeeLine label="Settlement & admin · 0.075%" value={fees.settlementAdminFee} symbol={currencySymbol} />
            <FeeLine label="Investor protection levy · 0.0002%" value={fees.iplAdminFee} symbol={currencySymbol} />
            <FeeLine label="VAT · 15%" value={fees.vatFee} symbol={currencySymbol} />
            <FeeLine label="Securities transfer tax · 0.25%" value={fees.securitiesTransferTaxFee} symbol={currencySymbol} />
            {accountType === 'USD' && <FeeLine label={`Foreign exchange · ${fxPct}%`} value={fees.fxFee} symbol={currencySymbol} />}
          </View>
        )}

        {quote && amount && shares > 0 && (
          <View style={styles.totalCard}>
            <Text style={styles.muted}>You'll pay in total</Text>
            <Text style={styles.totalValue}>{currencySymbol}{totalToPay.toFixed(2)}</Text>
            <Text style={styles.muted}>{shares.toFixed(6)} shares, plus {currencySymbol}{fees.totalFees.toFixed(2)} in fees</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="e.g., Monthly contribution"
            editable={!saving}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tags (comma separated)</Text>
          <TextInput
            style={styles.input}
            value={tagsInput}
            onChangeText={setTagsInput}
            placeholder="e.g., core, monthly"
            editable={!saving}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable style={styles.secondaryBtn} onPress={() => router.back()} disabled={saving}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, { flex: 2 }, (!quote || !amount || saving) && styles.disabled]}
            onPress={handleSave}
            disabled={!quote || !amount || saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save this buy</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function FeeLine({ label, value, symbol }: { label: string; value: number; symbol: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.feeValue}>{symbol}{value.toFixed(2)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted },
  error: { fontSize: 13, color: colors.loss },
  input: { borderWidth: 1, borderColor: colors.border, padding: 12, fontSize: 15, backgroundColor: colors.surface },
  segRow: { flexDirection: 'row', gap: 8 },
  segOpt: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  segOptActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segOptText: { fontSize: 14, color: colors.text },
  segOptTextActive: { color: '#fff', fontWeight: '600' },
  suggestions: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  suggestionRow: { padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionSymbol: { fontSize: 14, fontWeight: '600' },
  quoteCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.surface, padding: 14,
  },
  ticker: { fontSize: 15, fontWeight: '600' },
  quotePrice: { fontSize: 22, fontWeight: '700', color: colors.accent },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  cardTitle: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  feeValue: { fontSize: 12, color: colors.text },
  totalCard: { backgroundColor: colors.accentSoft, padding: 16, gap: 4 },
  totalValue: { fontSize: 28, fontWeight: '700' },
  primaryBtn: { backgroundColor: colors.accent, padding: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  secondaryBtnText: { fontWeight: '600', fontSize: 15, color: colors.text },
  disabled: { opacity: 0.5 },
})

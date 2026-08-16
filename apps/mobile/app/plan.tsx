// File: apps/mobile/app/plan.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'
import { fetchQuote, getActiveTickers, getTickerName, validateTargetsSumTo100 } from '@portfolio-tracker/api-client'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { fonts } from '../lib/theme'
import Segmented from '../components/Segmented'
import WeightBar from '../components/WeightBar'
import Button from '../components/Button'

type AccountType = 'ZAR' | 'USD'

interface TargetRow {
  ticker: string
  target_weight_pct: number
  account_type: AccountType
}

export default function PlanScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const [accountFilter, setAccountFilter] = useState<AccountType>('ZAR')
  const [allTargets, setAllTargets] = useState<TargetRow[]>([])
  const [currentWeights, setCurrentWeights] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const { data: targetsData, error: targetError } = await supabase.from('targets').select('*').order('ticker', { ascending: true })
      if (targetError) throw targetError
      setAllTargets((targetsData || []).map((t: any) => ({
        ticker: t.ticker, target_weight_pct: t.target_weight_pct, account_type: (t.account_type || 'ZAR') as AccountType,
      })))

      const { data: transactions, error: txError } = await supabase.from('transactions').select('ticker, shares, account_type').eq('account_type', accountFilter)
      if (txError) throw txError

      const sharesByTicker = new Map<string, number>()
      ;(transactions || []).forEach((tx: any) => {
        sharesByTicker.set(tx.ticker, (sharesByTicker.get(tx.ticker) || 0) + tx.shares)
      })
      const activeTickers = Array.from(sharesByTicker.entries()).filter(([, s]) => s > 0).map(([t]) => t)

      if (activeTickers.length === 0) {
        setCurrentWeights({})
        return
      }
      const priceResults = await Promise.all(
        activeTickers.map(async (ticker) => {
          try {
            const quote = await fetchQuote(supabase, ticker)
            return { ticker, price: quote.price_zar }
          } catch {
            return null
          }
        })
      )
      let totalValue = 0
      const valueByTicker = new Map<string, number>()
      activeTickers.forEach((ticker) => {
        const result = priceResults.find((r) => r?.ticker === ticker)
        if (!result) return
        const value = (sharesByTicker.get(ticker) || 0) * result.price
        valueByTicker.set(ticker, value)
        totalValue += value
      })
      const weights: Record<string, number> = {}
      valueByTicker.forEach((value, ticker) => { weights[ticker] = totalValue > 0 ? (value / totalValue) * 100 : 0 })
      setCurrentWeights(weights)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan')
    } finally {
      setLoading(false)
    }
  }, [accountFilter])

  useEffect(() => {
    load()
  }, [load])

  const targets = useMemo(() => allTargets.filter((t) => t.account_type === accountFilter), [allTargets, accountFilter])
  const validation = validateTargetsSumTo100(targets)
  const zarCount = allTargets.filter((t) => t.account_type === 'ZAR').length
  const usdCount = allTargets.filter((t) => t.account_type === 'USD').length

  const addRow = () => {
    setAllTargets([...allTargets, { ticker: '', target_weight_pct: 0, account_type: accountFilter }])
  }

  const removeRow = (index: number) => {
    const target = targets[index]
    setAllTargets(allTargets.filter((t) => t !== target))
  }

  const updateRow = (index: number, field: 'ticker' | 'target_weight_pct', value: string) => {
    const target = targets[index]
    const allIndex = allTargets.indexOf(target)
    if (allIndex === -1) return
    const updated = [...allTargets]
    updated[allIndex] = field === 'ticker'
      ? { ...updated[allIndex], ticker: value.toUpperCase() }
      : { ...updated[allIndex], target_weight_pct: parseFloat(value) || 0 }
    setAllTargets(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const emptyTickers = allTargets.filter((t) => !t.ticker.trim())
      if (emptyTickers.length > 0) throw new Error('All tickers must be filled in')

      const zarTargets = allTargets.filter((t) => t.account_type === 'ZAR')
      const usdTargets = allTargets.filter((t) => t.account_type === 'USD')
      if (zarTargets.length > 0) {
        const v = validateTargetsSumTo100(zarTargets)
        if (!v.valid) throw new Error(`ZAR target weights must sum to 100%. Current sum: ${v.sum.toFixed(2)}%`)
      }
      if (usdTargets.length > 0) {
        const v = validateTargetsSumTo100(usdTargets)
        if (!v.valid) throw new Error(`USD target weights must sum to 100%. Current sum: ${v.sum.toFixed(2)}%`)
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: deleteError } = await supabase.from('targets').delete().eq('user_id', user.id)
      if (deleteError) throw deleteError

      if (allTargets.length > 0) {
        const { error: insertError } = await supabase.from('targets').insert(
          allTargets.map((t) => ({ user_id: user.id, ticker: t.ticker, target_weight_pct: t.target_weight_pct, account_type: t.account_type }))
        )
        if (insertError) throw insertError
      }

      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
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
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.heading }]}>What share should each fund be?</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12.5 }}>Set the split you're aiming for. We'll tell you when it drifts — we never move money for you.</Text>
        <Segmented
          options={[
            { value: 'ZAR', label: `ZAR (${zarCount})` },
            { value: 'USD', label: `USD (${usdCount})` },
          ]}
          value={accountFilter}
          onChange={setAccountFilter}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {targets.map((t, index) => {
          const now = currentWeights[t.ticker] || 0
          const drift = now - t.target_weight_pct
          const name = t.ticker ? getTickerName(t.ticker) : undefined
          return (
            <View key={index} style={[styles.row, { borderBottomColor: colors.divider }]}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[styles.tickerInput, { color: colors.text, fontFamily: fonts.heading }]}
                    value={t.ticker}
                    onChangeText={(v) => updateRow(index, 'ticker', v)}
                    placeholder="TICKER"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    editable={!saving}
                  />
                  {name && <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>{name}</Text>}
                </View>
                <TextInput
                  style={[styles.pctInput, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
                  value={t.target_weight_pct ? t.target_weight_pct.toString() : ''}
                  onChangeText={(v) => updateRow(index, 'target_weight_pct', v)}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  placeholderTextColor={colors.textMuted}
                  editable={!saving}
                />
                <Pressable style={styles.removeBtn} onPress={() => removeRow(index)} disabled={saving}>
                  <Text style={{ color: colors.loss, fontSize: 15 }}>✕</Text>
                </Pressable>
              </View>
              <WeightBar currentPct={now} targetPct={t.target_weight_pct} />
              <Text style={{ color: Math.abs(drift) > 0.5 ? colors.loss : colors.textMuted, fontFamily: 'ui-monospace', fontSize: 12 }}>
                now {now.toFixed(1)}%{Math.abs(drift) > 0.5 ? ` · ${Math.abs(drift).toFixed(1)} pts ${drift > 0 ? 'over' : 'under'}` : ''}
              </Text>
            </View>
          )
        })}

        <Button label={`+ Add another ${accountFilter} target`} variant="secondary" onPress={addRow} block disabled={saving} />

        {error && <Text style={{ color: colors.loss, fontSize: 13 }}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.divider, backgroundColor: colors.accentWash }]}>
        <View>
          <Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 22 }}>{validation.sum.toFixed(1)}%</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {targets.length === 0 ? 'No targets set for this account.' : validation.valid ? "Adds up — you're good to save." : 'Must sum to 100% to save.'}
          </Text>
        </View>
        <Button label={saving ? '' : 'Save plan'} loading={saving} variant="primary" onPress={handleSave} disabled={saving} style={{ marginLeft: 'auto' }} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 18, paddingBottom: 12, borderBottomWidth: 1, gap: 8 },
  title: { fontSize: 24, letterSpacing: -0.3, lineHeight: 28 },
  scroll: { padding: 18, gap: 14 },
  row: { paddingBottom: 12, borderBottomWidth: 1, gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tickerInput: { fontSize: 17, paddingVertical: 6 },
  pctInput: { width: 80, borderWidth: 1, padding: 10, fontSize: 15, textAlign: 'right' },
  removeBtn: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 16, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
})

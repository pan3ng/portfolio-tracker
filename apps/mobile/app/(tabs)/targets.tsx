// File: apps/mobile/app/(tabs)/targets.tsx
import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { fetchQuote, calculatePortfolio, getActiveTickers, type HoldingCalc } from '@portfolio-tracker/api-client'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

export default function TargetsScreen() {
  const [holdings, setHoldings] = useState<HoldingCalc[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [{ data: transactions, error: txError }, { data: targets, error: targetError }] = await Promise.all([
        supabase.from('transactions').select('*'),
        supabase.from('targets').select('*'),
      ])
      if (txError) throw txError
      if (targetError) throw targetError

      const activeTickers = getActiveTickers(transactions || [])
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
      const prices = new Map<string, number>()
      priceResults.forEach((r) => { if (r) prices.set(r.ticker, r.price) })

      const result = calculatePortfolio(transactions || [], [], targets || [], prices)
      setHoldings(result.holdings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load targets')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Targets</Text>
      <Text style={styles.muted}>How far current holdings have drifted from plan. Set targets from the web app.</Text>

      {holdings.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.muted}>No holdings yet.</Text>
        </View>
      ) : (
        <FlatList
          data={holdings}
          keyExtractor={(h) => h.ticker}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
          renderItem={({ item }) => {
            const driftAbs = Math.abs(item.drift_pct)
            const driftColor = driftAbs < 2 ? colors.gain : driftAbs < 5 ? '#c48a3f' : colors.loss
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.ticker}>{item.ticker}</Text>
                  <Text style={[styles.drift, { color: driftColor }]}>
                    {item.drift_pct >= 0 ? '+' : ''}{item.drift_pct.toFixed(1)}pp
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.min(item.current_weight_pct, 100)}%` }]} />
                  {item.target_weight_pct > 0 && (
                    <View style={[styles.targetMarker, { left: `${Math.min(item.target_weight_pct, 100)}%` }]} />
                  )}
                </View>
                <View style={styles.cardHeader}>
                  <Text style={styles.muted}>Now {item.current_weight_pct.toFixed(1)}%</Text>
                  <Text style={styles.muted}>Target {item.target_weight_pct.toFixed(1)}%</Text>
                </View>
              </View>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  muted: { fontSize: 12, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticker: { fontSize: 16, fontWeight: '600' },
  drift: { fontSize: 13, fontWeight: '600' },
  barTrack: { height: 8, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  barFill: { height: '100%', backgroundColor: colors.accent },
  targetMarker: { position: 'absolute', top: -2, width: 2, height: 12, backgroundColor: colors.text },
})

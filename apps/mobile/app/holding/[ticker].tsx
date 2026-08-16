// File: apps/mobile/app/holding/[ticker].tsx
import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams } from 'expo-router'
import { fetchQuote, calculatePortfolio, type HoldingCalc } from '@portfolio-tracker/api-client'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

interface TransactionRow {
  id: string
  date: string
  shares: number
  price_at_transaction: number
}

export default function HoldingDetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>()
  const [holding, setHolding] = useState<HoldingCalc | null>(null)
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!ticker) return
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('ticker', ticker)
        .order('date', { ascending: false })
      if (fetchError) throw fetchError
      const rows = (data as any[]) || []
      setTransactions(rows)

      const quote = await fetchQuote(supabase, ticker)
      const prices = new Map<string, number>([[ticker, quote.price_zar]])
      const result = calculatePortfolio(rows, [], [], prices)
      setHolding(result.holdings[0] ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load holding')
    } finally {
      setLoading(false)
    }
  }, [ticker])

  useEffect(() => {
    load()
  }, [load])

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: ticker }} />

      {loading ? (
        <View style={styles.centered}><ActivityIndicator /></View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          {holding && (
            <View style={styles.card}>
              <Text style={styles.metricLabel}>Current value</Text>
              <Text style={styles.heroValue}>R{holding.current_value.toFixed(2)}</Text>
              <View style={styles.metricsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metricLabel}>Shares held</Text>
                  <Text style={styles.metricValue}>{holding.shares.toFixed(6)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metricLabel}>Current price</Text>
                  <Text style={styles.metricValue}>R{holding.current_price.toFixed(2)}</Text>
                </View>
              </View>
              <View style={styles.metricsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metricLabel}>Gain since bought</Text>
                  <Text style={[styles.metricValue, { color: holding.market_profit_loss >= 0 ? colors.gain : colors.loss }]}>
                    {holding.market_profit_loss >= 0 ? '+' : ''}R{holding.market_profit_loss.toFixed(2)} ({holding.market_profit_loss_pct.toFixed(1)}%)
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metricLabel}>Return after fees</Text>
                  <Text style={[styles.metricValue, { color: holding.profit_loss >= 0 ? colors.gain : colors.loss }]}>
                    {holding.profit_loss >= 0 ? '+' : ''}R{holding.profit_loss.toFixed(2)} ({holding.profit_loss_pct.toFixed(1)}%)
                  </Text>
                </View>
              </View>
              <View style={styles.metricsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metricLabel}>Cost basis (incl. fees)</Text>
                  <Text style={styles.metricValue}>R{holding.purchase_value.toFixed(2)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metricLabel}>Total fees paid</Text>
                  <Text style={styles.metricValue}>R{holding.fees.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>Transactions</Text>
          <FlatList
            data={transactions}
            keyExtractor={(tx) => tx.id}
            renderItem={({ item }: { item: TransactionRow }) => {
              const amount = item.shares * item.price_at_transaction
              return (
                <View style={styles.txRow}>
                  <View>
                    <Text style={styles.txShares}>{item.shares.toFixed(6)} sh</Text>
                    <Text style={styles.metricLabel}>{new Date(item.date).toLocaleDateString()} @ R{item.price_at_transaction.toFixed(2)}</Text>
                  </View>
                  <Text style={styles.txAmount}>R{amount.toFixed(2)}</Text>
                </View>
              )
            }}
          />
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.loss, fontSize: 13 },
  card: { backgroundColor: colors.accentSoft, padding: 16, gap: 12 },
  metricLabel: { fontSize: 12, color: colors.textMuted },
  heroValue: { fontSize: 32, fontWeight: '700' },
  metricsRow: { flexDirection: 'row', gap: 12 },
  metricValue: { fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  txRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  txShares: { fontSize: 14, fontWeight: '600' },
  txAmount: { fontSize: 14, fontWeight: '600' },
})

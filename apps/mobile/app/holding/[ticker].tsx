// File: apps/mobile/app/holding/[ticker].tsx
import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { fetchQuote, calculatePortfolio, getActiveTickers, getTickerName, type HoldingCalc } from '@portfolio-tracker/api-client'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/ThemeContext'
import { fonts } from '../../lib/theme'
import BlueprintCard from '../../components/BlueprintCard'
import WeightBar from '../../components/WeightBar'
import Tag from '../../components/Tag'
import Button from '../../components/Button'

interface TransactionRow {
  id: string
  date: string
  shares: number
  price_at_transaction: number
  transaction_type?: string
}

export default function HoldingDetailScreen() {
  const router = useRouter()
  const { ticker } = useLocalSearchParams<{ ticker: string }>()
  const { colors } = useTheme()
  const [holding, setHolding] = useState<HoldingCalc | null>(null)
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!ticker) return
    setError(null)
    try {
      // Fetch ALL transactions/targets (not just this ticker's) — current_weight_pct
      // and drift_pct only mean anything relative to the whole portfolio's value.
      const [{ data: allTx, error: fetchError }, { data: targets }] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('targets').select('*'),
      ])
      if (fetchError) throw fetchError
      const allRows = (allTx as any[]) || []
      setTransactions(allRows.filter((tx) => tx.ticker === ticker))

      const activeTickers = getActiveTickers(allRows)
      const priceResults = await Promise.all(
        activeTickers.map(async (t) => {
          try {
            const quote = await fetchQuote(supabase, t)
            return { ticker: t, price: quote.price_zar }
          } catch {
            return null
          }
        })
      )
      const prices = new Map<string, number>()
      priceResults.forEach((r) => { if (r) prices.set(r.ticker, r.price) })

      const result = calculatePortfolio(allRows, [], targets || [], prices)
      setHolding(result.holdings.find((h) => h.ticker === ticker) ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load holding')
    } finally {
      setLoading(false)
    }
  }, [ticker])

  useEffect(() => {
    load()
  }, [load])

  const name = ticker ? getTickerName(ticker) : undefined
  const avgCost = holding && holding.shares > 0 ? holding.share_value / holding.shares : 0
  const isOver = holding && holding.target_weight_pct > 0 && holding.drift_pct > 0.5
  const isUnder = holding && holding.target_weight_pct > 0 && holding.drift_pct < -0.5

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>
      ) : error ? (
        <Text style={{ color: colors.loss, padding: 18 }}>{error}</Text>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(tx) => tx.id}
          ListHeaderComponent={
            <View>
              <View style={[styles.header, { borderBottomColor: colors.divider }]}>
                <Text style={{ color: colors.accent700, fontSize: 12.5 }} onPress={() => router.back()}>← Holdings</Text>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { color: colors.text, fontFamily: fonts.heading }]}>{ticker}</Text>
                  {isOver && <Tag label="Overweight" variant="outline" />}
                  {isUnder && <Tag label="Underweight" variant="outline" />}
                  {holding && (
                    <Text style={[styles.mono, { color: colors.text, fontFamily: fonts.heading, marginLeft: 'auto', fontSize: 18 }]}>
                      R {holding.current_price.toFixed(2)}
                    </Text>
                  )}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>{name || ''}</Text>
              </View>

              {holding && (
                <View style={styles.body}>
                  <View style={styles.grid2}>
                    <BlueprintCard style={styles.gridCard}>
                      <Text style={[styles.kicker, { color: colors.textMuted }]}>Shares</Text>
                      <Text style={[styles.mono, { color: colors.text, fontFamily: fonts.heading, fontSize: 19 }]}>{holding.shares.toFixed(6)}</Text>
                    </BlueprintCard>
                    <BlueprintCard style={styles.gridCard}>
                      <Text style={[styles.kicker, { color: colors.textMuted }]}>Avg cost</Text>
                      <Text style={[styles.mono, { color: colors.text, fontFamily: fonts.heading, fontSize: 19 }]}>R {avgCost.toFixed(2)}</Text>
                    </BlueprintCard>
                    <BlueprintCard style={styles.gridCard}>
                      <Text style={[styles.kicker, { color: colors.textMuted }]}>Market value</Text>
                      <Text style={[styles.mono, { color: colors.text, fontFamily: fonts.heading, fontSize: 19 }]}>R {holding.current_value.toFixed(2)}</Text>
                    </BlueprintCard>
                    <BlueprintCard style={styles.gridCard}>
                      <Text style={[styles.kicker, { color: colors.textMuted }]}>Unrealised, after fees</Text>
                      <Text style={[styles.mono, { color: holding.profit_loss >= 0 ? colors.gain : colors.loss, fontFamily: fonts.heading, fontSize: 19 }]}>
                        {holding.profit_loss >= 0 ? '+' : ''}R {holding.profit_loss.toFixed(2)}
                      </Text>
                      <Text style={[styles.sub, { color: colors.textMuted }]}>fees paid R {holding.fees.toFixed(2)}</Text>
                    </BlueprintCard>
                  </View>

                  {holding.target_weight_pct > 0 ? (
                    <BlueprintCard>
                      <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.heading }]}>Weight vs target</Text>
                      <WeightBar currentPct={holding.current_weight_pct} targetPct={holding.target_weight_pct} height={10} />
                      <View style={styles.spread}>
                        <Text style={[styles.mono, { color: colors.text, fontSize: 12 }]}>now {holding.current_weight_pct.toFixed(1)}%</Text>
                        <Text style={[styles.mono, { color: colors.loss, fontSize: 12 }]}>
                          target {holding.target_weight_pct.toFixed(1)}% · {holding.drift_pct >= 0 ? '+' : ''}{holding.drift_pct.toFixed(1)} pts
                        </Text>
                      </View>
                    </BlueprintCard>
                  ) : (
                    <BlueprintCard>
                      <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.heading }]}>Weight vs target</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12.5 }}>
                        Now {holding.current_weight_pct.toFixed(1)}% of your portfolio — no target set yet.
                      </Text>
                      <Button
                        label="Set target"
                        variant="secondary"
                        onPress={() => router.push(`/plan?ticker=${holding.ticker}&account=${holding.account_type}`)}
                      />
                    </BlueprintCard>
                  )}

                  <BlueprintCard dashed style={{ alignItems: 'center', paddingVertical: 18 }}>
                    <Text style={[styles.kicker, { color: colors.textMuted, fontFamily: fonts.heading }]}>Price since your first buy</Text>
                    <Text style={[styles.sub, { color: colors.textMuted }]}>Needs price history — coming soon</Text>
                  </BlueprintCard>

                  <View style={styles.spread}>
                    <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.heading }]}>Your transactions</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>{transactions.length} total</Text>
                  </View>
                </View>
              )}
            </View>
          }
          contentContainerStyle={{ paddingBottom: 18 }}
          renderItem={({ item }) => {
            const amount = item.shares * item.price_at_transaction
            return (
              <View style={[styles.txRow, { borderBottomColor: colors.divider, paddingHorizontal: 18 }]}>
                <Text style={[styles.mono, { color: colors.text, fontSize: 13 }]}>{new Date(item.date).toLocaleDateString()}</Text>
                <Tag label="Buy" variant="accent" />
                <Text style={[styles.mono, { color: colors.text, fontSize: 14, marginLeft: 'auto' }]}>R {amount.toFixed(2)}</Text>
                <Text style={[styles.mono, { color: colors.textMuted, fontSize: 11.5, width: '100%' }]}>
                  {item.shares.toFixed(6)} sh @ R {item.price_at_transaction.toFixed(2)}
                </Text>
              </View>
            )
          }}
        />
      )}

      {holding && (
        <View style={[styles.footer, { borderTopColor: colors.divider }]}>
          <Button label="Sell" variant="secondary" onPress={() => {}} disabled style={{ flex: 1 }} />
          <Button label="Buy more" variant="primary" onPress={() => router.push(`/transactions/new?ticker=${ticker}`)} style={{ flex: 2 }} />
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 18, paddingBottom: 12, borderBottomWidth: 1, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  title: { fontSize: 30, letterSpacing: -0.3 },
  body: { padding: 18, gap: 14 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: { flexBasis: '47%', flexGrow: 1 },
  kicker: { fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  sub: { fontSize: 11.5 },
  mono: { fontFamily: 'ui-monospace', fontVariant: ['tabular-nums'] },
  sectionTitle: { fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  txRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1 },
  footer: { padding: 14, borderTopWidth: 1, flexDirection: 'row', gap: 10 },
})

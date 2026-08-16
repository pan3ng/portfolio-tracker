// File: apps/mobile/app/index.tsx
import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  fetchQuote,
  calculatePortfolio,
  getActiveTickers,
  type HoldingCalc,
  type PortfolioCalcResult,
} from '@portfolio-tracker/api-client'
import { supabase } from '../lib/supabase'

const EMPTY_RESULT: PortfolioCalcResult = {
  holdings: [], totalValue: 0, totalShareInvestment: 0, totalFeesPaid: 0, totalCostBasis: 0,
  totalMarketProfit: 0, totalMarketProfitPct: 0, totalProfitLoss: 0, totalProfitLossPct: 0,
  totalDeposits: 0, totalDepositFees: 0, uninvestedCapital: 0,
}

export default function OverviewScreen() {
  const [result, setResult] = useState<PortfolioCalcResult>(EMPTY_RESULT)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [{ data: transactions, error: txError }, { data: deposits, error: depError }, { data: targets, error: targetError }] =
        await Promise.all([
          supabase.from('transactions').select('*').order('date', { ascending: false }),
          supabase.from('deposits').select('*'),
          supabase.from('targets').select('*'),
        ])
      if (txError) throw txError
      if (depError) throw depError
      if (targetError) throw targetError

      const activeTickers = getActiveTickers(transactions || [])
      const priceResults = await Promise.all(
        activeTickers.map(async (ticker) => {
          try {
            const quote = await fetchQuote(supabase, ticker)
            return { ticker, price: quote.price_zar }
          } catch (err) {
            console.error(`Failed to fetch quote for ${ticker}:`, err)
            return null
          }
        })
      )
      const prices = new Map<string, number>()
      priceResults.forEach((r) => { if (r) prices.set(r.ticker, r.price) })

      setResult(calculatePortfolio(transactions || [], deposits || [], targets || [], prices))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSignOut = () => {
    supabase.auth.signOut()
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>Portfolio Tracker</Text>
        <Pressable onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.heroCard}>
        <Text style={styles.metricLabel}>What your investments are worth</Text>
        <Text style={styles.heroValue}>R{result.totalValue.toFixed(2)}</Text>
        <Text style={styles.metricSub}>{result.holdings.length} holding{result.holdings.length === 1 ? '' : 's'}</Text>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Gain since you started</Text>
          <Text style={[styles.metricValue, { color: result.totalMarketProfit >= 0 ? '#3f7a5c' : '#9d5f68' }]}>
            {result.totalMarketProfit >= 0 ? '+' : ''}R{result.totalMarketProfit.toFixed(2)}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total return after fees</Text>
          <Text style={[styles.metricValue, { color: result.totalProfitLoss >= 0 ? '#3f7a5c' : '#9d5f68' }]}>
            {result.totalProfitLoss >= 0 ? '+' : ''}R{result.totalProfitLoss.toFixed(2)}
          </Text>
        </View>
      </View>

      {result.holdings.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.metricSub}>No holdings yet. Add a transaction from the web app to get started.</Text>
        </View>
      ) : (
        <FlatList
          data={result.holdings}
          keyExtractor={(h) => h.ticker}
          renderItem={({ item }: { item: HoldingCalc }) => (
            <View style={styles.row}>
              <View>
                <Text style={styles.rowTicker}>{item.ticker}</Text>
                <Text style={styles.metricSub}>{item.current_weight_pct.toFixed(1)}% of portfolio</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.rowValue}>R{item.current_value.toFixed(2)}</Text>
                <Text style={{ color: item.profit_loss_pct >= 0 ? '#3f7a5c' : '#9d5f68', fontSize: 13 }}>
                  {item.profit_loss_pct >= 0 ? '+' : ''}{item.profit_loss_pct.toFixed(1)}%
                </Text>
              </View>
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f3', padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: 18, fontWeight: '600' },
  signOut: { fontSize: 14, opacity: 0.6 },
  error: { color: '#9d5f68', fontSize: 13 },
  heroCard: { backgroundColor: '#e5eef5', padding: 16, gap: 4 },
  heroValue: { fontSize: 36, fontWeight: '700' },
  metricsRow: { flexDirection: 'row', gap: 12 },
  metricCard: { flex: 1, backgroundColor: '#fff', padding: 14, gap: 4, borderWidth: 1, borderColor: '#e2e2e4' },
  metricLabel: { fontSize: 12, opacity: 0.6 },
  metricValue: { fontSize: 20, fontWeight: '700' },
  metricSub: { fontSize: 12, opacity: 0.6 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e2e4',
  },
  rowTicker: { fontSize: 16, fontWeight: '600' },
  rowValue: { fontSize: 16, fontWeight: '600' },
})

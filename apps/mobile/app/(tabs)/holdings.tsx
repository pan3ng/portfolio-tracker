// File: apps/mobile/app/(tabs)/holdings.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  fetchQuote,
  calculatePortfolio,
  getActiveTickers,
  getTickerName,
  type HoldingCalc,
  type PortfolioCalcResult,
} from '@portfolio-tracker/api-client'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/ThemeContext'
import { fonts } from '../../lib/theme'
import Segmented from '../../components/Segmented'
import Tag from '../../components/Tag'
import WeightBar from '../../components/WeightBar'
import Button from '../../components/Button'

const EMPTY_RESULT: PortfolioCalcResult = {
  holdings: [], totalValue: 0, totalShareInvestment: 0, totalFeesPaid: 0, totalCostBasis: 0,
  totalMarketProfit: 0, totalMarketProfitPct: 0, totalProfitLoss: 0, totalProfitLossPct: 0,
  totalDeposits: 0, totalDepositFees: 0, uninvestedCapital: 0,
}

type AccountFilter = 'All' | 'ZAR' | 'USD'
type SortKey = 'value' | 'ticker' | 'return'

export default function HoldingsScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const [result, setResult] = useState<PortfolioCalcResult>(EMPTY_RESULT)
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('All')
  const [sort, setSort] = useState<SortKey>('value')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [{ data: transactions, error: txError }, { data: deposits, error: depError }, { data: targets, error: targetError }] =
        await Promise.all([
          supabase.from('transactions').select('*'),
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
          } catch {
            return null
          }
        })
      )
      const prices = new Map<string, number>()
      priceResults.forEach((r) => { if (r) prices.set(r.ticker, r.price) })

      setResult(calculatePortfolio(transactions || [], deposits || [], targets || [], prices))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load holdings')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const holdings = useMemo(() => {
    let list = accountFilter === 'All' ? result.holdings : result.holdings.filter((h) => h.account_type === accountFilter)
    list = [...list].sort((a, b) => {
      if (sort === 'ticker') return a.ticker.localeCompare(b.ticker)
      if (sort === 'return') return b.profit_loss_pct - a.profit_loss_pct
      return b.current_value - a.current_value
    })
    return list
  }, [result.holdings, accountFilter, sort])

  const total = holdings.reduce((s, h) => s + h.current_value, 0)

  if (loading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.heading }]}>Holdings</Text>
          <Text style={[styles.mono, { color: colors.text }]}>R {total.toFixed(0)}</Text>
        </View>
        <View style={styles.headerRow}>
          <Segmented
            options={[{ value: 'All', label: 'All' }, { value: 'ZAR', label: 'ZAR' }, { value: 'USD', label: 'USD' }]}
            value={accountFilter}
            onChange={setAccountFilter}
          />
          <Pressable
            style={styles.sortBtn}
            onPress={() => setSort((s) => (s === 'value' ? 'return' : s === 'return' ? 'ticker' : 'value'))}
          >
            <Text style={{ color: colors.accent700, fontSize: 12 }}>
              Sort: {sort === 'value' ? 'Value' : sort === 'return' ? 'Return' : 'Ticker'} ▾
            </Text>
          </Pressable>
        </View>
      </View>

      {error && <Text style={[styles.error, { color: colors.loss }]}>{error}</Text>}

      {holdings.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.textMuted }}>No holdings yet.</Text>
        </View>
      ) : (
        <FlatList
          data={holdings}
          keyExtractor={(h) => h.ticker}
          contentContainerStyle={{ paddingHorizontal: 18 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
          renderItem={({ item }: { item: HoldingCalc }) => {
            const isOver = item.target_weight_pct > 0 && item.drift_pct > 0.5
            const isUnder = item.target_weight_pct > 0 && item.drift_pct < -0.5
            const name = getTickerName(item.ticker)
            return (
              <Pressable
                style={({ pressed }) => [styles.row, { borderBottomColor: colors.divider }, pressed && { opacity: 0.6 }]}
                onPress={() => router.push(`/holding/${item.ticker}`)}
              >
                <View style={styles.rowTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.tickerLine}>
                      <Text style={[styles.ticker, { color: colors.text, fontFamily: fonts.heading }]}>{item.ticker}</Text>
                      {isOver && <Tag label="Overweight" variant="outline" />}
                      {isUnder && <Tag label="Underweight" variant="outline" />}
                    </View>
                    <Text style={[styles.sub, { color: colors.textMuted }]}>{name || item.account_type}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.mono, { color: colors.text, fontSize: 16 }]}>R {item.current_value.toFixed(2)}</Text>
                    <Text style={[styles.mono, { color: item.market_profit_loss_pct >= 0 ? colors.gain : colors.loss, fontSize: 12 }]}>
                      {item.market_profit_loss_pct >= 0 ? '+' : ''}{item.market_profit_loss_pct.toFixed(1)}%
                    </Text>
                  </View>
                </View>
                {item.target_weight_pct > 0 ? (
                  <View style={styles.barRow}>
                    <View style={{ flex: 1 }}>
                      <WeightBar
                        currentPct={item.current_weight_pct}
                        targetPct={item.target_weight_pct}
                        fillColor={isOver ? colors.lossBorder : isUnder ? colors.accent300 : colors.accent}
                      />
                    </View>
                    <Text style={[styles.mono, { color: isOver || isUnder ? colors.loss : colors.textMuted, fontSize: 11.5, width: 100, textAlign: 'right' }]}>
                      {item.current_weight_pct.toFixed(1)}% / {item.target_weight_pct.toFixed(1)}%
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); router.push(`/plan?ticker=${item.ticker}&account=${item.account_type}`) }}
                  >
                    <Text style={{ color: colors.accent700, fontSize: 12 }}>Set target →</Text>
                  </Pressable>
                )}
              </Pressable>
            )
          }}
        />
      )}

      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        <Button label="+ Add Transaction" variant="primary" onPress={() => router.push('/transactions/new')} style={{ flex: 1 }} />
        <Button label="Plan" variant="secondary" onPress={() => router.push('/plan')} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  headerTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  title: { fontSize: 26, letterSpacing: -0.3, marginRight: 'auto' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortBtn: { marginLeft: 'auto' },
  error: { fontSize: 13, paddingHorizontal: 18, paddingTop: 8 },
  mono: { fontFamily: 'ui-monospace', fontVariant: ['tabular-nums'] },
  row: { paddingVertical: 14, borderBottomWidth: 1, gap: 6 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  tickerLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticker: { fontSize: 17 },
  sub: { fontSize: 11.5 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footer: { padding: 14, borderTopWidth: 1, flexDirection: 'row', gap: 10, alignItems: 'center' },
})

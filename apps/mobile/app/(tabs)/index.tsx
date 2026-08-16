// File: apps/mobile/app/(tabs)/index.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  fetchQuote,
  calculatePortfolio,
  getActiveTickers,
  type HoldingCalc,
  type PortfolioCalcResult,
} from '@portfolio-tracker/api-client'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/ThemeContext'
import { fonts } from '../../lib/theme'
import BlueprintCard from '../../components/BlueprintCard'
import Segmented from '../../components/Segmented'
import WeightBar from '../../components/WeightBar'

const EMPTY_RESULT: PortfolioCalcResult = {
  holdings: [], totalValue: 0, totalShareInvestment: 0, totalFeesPaid: 0, totalCostBasis: 0,
  totalMarketProfit: 0, totalMarketProfitPct: 0, totalProfitLoss: 0, totalProfitLossPct: 0,
  totalDeposits: 0, totalDepositFees: 0, uninvestedCapital: 0,
}

type AccountFilter = 'All' | 'ZAR' | 'USD'
const ALLOCATION_COLORS = ['#5980a6', '#749dc4', '#94bce3', '#a8737d', '#2c455d', '#c79aa1']

function suggestNextMove(result: PortfolioCalcResult): string | null {
  const cash = result.uninvestedCapital
  if (cash <= 0) return null
  const underweight = result.holdings
    .filter((h) => h.target_weight_pct > 0 && h.drift_pct < -0.5)
    .sort((a, b) => a.drift_pct - b.drift_pct)
    .slice(0, 2)
  if (underweight.length === 0) return null

  if (underweight.length === 1) {
    return `Buy R ${cash.toFixed(0)} of ${underweight[0].ticker} — closer to plan, nothing to sell.`
  }
  const totalGap = underweight.reduce((sum, h) => sum + Math.abs(h.drift_pct), 0)
  const parts = underweight.map((h) => {
    const share = totalGap > 0 ? Math.abs(h.drift_pct) / totalGap : 1 / underweight.length
    return `R ${(cash * share).toFixed(0)} of ${h.ticker}`
  })
  return `Buy ${parts.join(' and ')} — closer to plan, nothing to sell.`
}

interface RecentItem {
  id: string
  kind: 'transaction' | 'deposit'
  date: string
  label: string
  amount: number
}

export default function OverviewScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('All')
  const [result, setResult] = useState<PortfolioCalcResult>(EMPTY_RESULT)
  const [depositCount, setDepositCount] = useState(0)
  const [recent, setRecent] = useState<RecentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [{ data: transactions, error: txError }, { data: deposits, error: depError }, { data: targets, error: targetError }] =
        await Promise.all([
          supabase.from('transactions').select('*').order('date', { ascending: false }),
          supabase.from('deposits').select('*').order('date', { ascending: false }),
          supabase.from('targets').select('*'),
        ])
      if (txError) throw txError
      if (depError) throw depError
      if (targetError) throw targetError

      const allTx = transactions || []
      const allDeposits = deposits || []

      const activeTickers = getActiveTickers(allTx)
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

      setResult(calculatePortfolio(allTx, allDeposits, targets || [], prices))
      setDepositCount(allDeposits.length)

      const recentTx: RecentItem[] = allTx.slice(0, 5).map((tx: any) => ({
        id: tx.id, kind: 'transaction', date: tx.date, label: tx.ticker,
        amount: tx.shares * tx.price_at_transaction,
      }))
      const recentDep: RecentItem[] = allDeposits.slice(0, 5).map((d: any) => ({
        id: d.id, kind: 'deposit', date: d.date, label: 'Deposit', amount: d.amount,
      }))
      setRecent([...recentTx, ...recentDep].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 3))
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

  const filteredHoldings = useMemo(
    () => (accountFilter === 'All' ? result.holdings : result.holdings.filter((h) => h.account_type === accountFilter)),
    [result.holdings, accountFilter]
  )

  const driftPts = useMemo(() => {
    const targeted = filteredHoldings.filter((h) => h.target_weight_pct > 0)
    if (targeted.length === 0) return 0
    return targeted.reduce((sum, h) => sum + Math.abs(h.drift_pct), 0) / 2
  }, [filteredHoldings])

  const bestWorst = useMemo(() => {
    if (filteredHoldings.length === 0) return null
    const sorted = [...filteredHoldings].sort((a, b) => b.profit_loss_pct - a.profit_loss_pct)
    return { best: sorted[0], worst: sorted[sorted.length - 1] }
  }, [filteredHoldings])

  const suggestion = useMemo(() => suggestNextMove(result), [result])

  const allocationTotal = filteredHoldings.reduce((s, h) => s + h.current_value, 0)

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
        <Text style={[styles.brand, { color: colors.text, fontFamily: fonts.heading }]}>HOLDFOLIO</Text>
        <Segmented
          options={[{ value: 'All', label: 'All' }, { value: 'ZAR', label: 'ZAR' }, { value: 'USD', label: 'USD' }]}
          value={accountFilter}
          onChange={setAccountFilter}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
      >
        {error && <Text style={[styles.error, { color: colors.loss }]}>{error}</Text>}

        <BlueprintCard wash>
          <Text style={[styles.kicker, { color: colors.accent700 }]}>What your investments are worth</Text>
          <Text style={[styles.heroValue, { color: colors.text, fontFamily: fonts.heading }]}>R {allocationTotal.toFixed(0)}</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>{filteredHoldings.length} holding{filteredHoldings.length === 1 ? '' : 's'}</Text>
        </BlueprintCard>

        <View style={styles.row2}>
          <BlueprintCard style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: colors.textMuted }]}>Gain since you started</Text>
            <Text style={[styles.cardValue, { color: result.totalMarketProfit >= 0 ? colors.gain : colors.loss, fontFamily: fonts.heading }]}>
              {result.totalMarketProfit >= 0 ? '+' : ''}R {result.totalMarketProfit.toFixed(0)}
            </Text>
            <Text style={[styles.mono, { color: result.totalMarketProfit >= 0 ? colors.gain : colors.loss }]}>
              {result.totalMarketProfitPct >= 0 ? '+' : ''}{result.totalMarketProfitPct.toFixed(2)}%
            </Text>
          </BlueprintCard>
          <BlueprintCard style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: colors.textMuted }]}>Return after fees</Text>
            <Text style={[styles.cardValue, { color: result.totalProfitLoss >= 0 ? colors.gain : colors.loss, fontFamily: fonts.heading }]}>
              {result.totalProfitLoss >= 0 ? '+' : ''}R {result.totalProfitLoss.toFixed(0)}
            </Text>
            <Text style={[styles.mono, { color: result.totalProfitLoss >= 0 ? colors.gain : colors.loss }]}>
              {result.totalProfitLossPct >= 0 ? '+' : ''}{result.totalProfitLossPct.toFixed(2)}%
            </Text>
          </BlueprintCard>
        </View>

        <View style={[styles.statGrid, { borderTopColor: colors.divider, borderBottomColor: colors.divider }]}>
          <View style={styles.statCell}>
            <Text style={[styles.kicker, { color: colors.textMuted }]}>Off your plan by</Text>
            <Text style={[styles.statValue, { color: driftPts > 0.05 ? colors.loss : colors.text, fontFamily: fonts.heading }]}>{driftPts.toFixed(1)} pts</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.kicker, { color: colors.textMuted }]}>Cash ready to invest</Text>
            <Text style={[styles.statValue, { color: colors.text, fontFamily: fonts.heading }]}>R {result.uninvestedCapital.toFixed(0)}</Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>{depositCount} deposit{depositCount === 1 ? '' : 's'}, not yet invested</Text>
          </View>
          {bestWorst && (
            <View style={styles.statCell}>
              <Text style={[styles.kicker, { color: colors.textMuted }]}>Best / worst</Text>
              <Text style={[styles.mono, { color: colors.gain, fontSize: 13 }]}>{bestWorst.best.ticker} {bestWorst.best.profit_loss_pct >= 0 ? '+' : ''}{bestWorst.best.profit_loss_pct.toFixed(1)}%</Text>
              <Text style={[styles.mono, { color: colors.loss, fontSize: 13 }]}>{bestWorst.worst.ticker} {bestWorst.worst.profit_loss_pct >= 0 ? '+' : ''}{bestWorst.worst.profit_loss_pct.toFixed(1)}%</Text>
            </View>
          )}
        </View>

        {suggestion && (
          <BlueprintCard wash>
            <Text style={[styles.kicker, { color: colors.accent700 }]}>What to do next</Text>
            <Text style={[styles.suggestTitle, { color: colors.text, fontFamily: fonts.heading }]}>Put your cash to work</Text>
            <Text style={[styles.suggestBody, { color: colors.text }]}>{suggestion}</Text>
            <Pressable style={[styles.ctaBtn, { backgroundColor: colors.accent }]} onPress={() => router.push('/transactions/new')}>
              <Text style={{ color: colors.bg, fontFamily: fonts.heading, fontSize: 14 }}>Add Transaction</Text>
            </Pressable>
          </BlueprintCard>
        )}

        {filteredHoldings.length > 0 && (
          <BlueprintCard>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.heading }]}>Where the money sits</Text>
            <View style={styles.allocationBar}>
              {filteredHoldings.map((h, i) => (
                <View
                  key={h.ticker}
                  style={{ width: `${(h.current_value / allocationTotal) * 100}%`, backgroundColor: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length], height: '100%' }}
                />
              ))}
            </View>
            <View style={{ gap: 6, marginTop: 4 }}>
              {filteredHoldings.slice(0, 5).map((h, i) => (
                <View key={h.ticker} style={styles.legendRow}>
                  <View style={{ width: 10, height: 10, backgroundColor: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length] }} />
                  <Text style={[styles.legendLabel, { color: colors.text }]}>{h.ticker}</Text>
                  <Text style={[styles.mono, { color: colors.text, marginLeft: 'auto' }]}>{h.current_weight_pct.toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </BlueprintCard>
        )}

        <BlueprintCard dashed style={{ alignItems: 'center', paddingVertical: 18 }}>
          <Text style={[styles.comingSoonTitle, { color: colors.textMuted, fontFamily: fonts.heading }]}>What it's worth over time</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>Needs price history — coming soon</Text>
        </BlueprintCard>

        {recent.length > 0 && (
          <View>
            <View style={styles.recentHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.heading }]}>Recent activity</Text>
              <Pressable onPress={() => router.push('/activity')}>
                <Text style={{ color: colors.accent700, fontSize: 12 }}>View all →</Text>
              </Pressable>
            </View>
            {recent.map((item) => (
              <View key={item.id} style={[styles.activityRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.activityLabel, { color: colors.text, fontFamily: fonts.heading }]}>{item.label}</Text>
                <Text style={[styles.mono, { color: colors.text }]}>R {item.amount.toFixed(2)}</Text>
                <Text style={[styles.sub, { color: colors.textMuted }]}>{new Date(item.date).toLocaleDateString()}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1 },
  brand: { fontSize: 17, letterSpacing: 1, marginRight: 'auto' },
  scroll: { padding: 18, gap: 12 },
  error: { fontSize: 13 },
  kicker: { fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  heroValue: { fontSize: 34, letterSpacing: -0.5 },
  sub: { fontSize: 12 },
  row2: { flexDirection: 'row', gap: 14 },
  cardValue: { fontSize: 22 },
  mono: { fontFamily: 'ui-monospace', fontSize: 12, fontVariant: ['tabular-nums'] },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1 },
  statCell: { flexGrow: 1, flexBasis: '30%', gap: 4 },
  statValue: { fontSize: 18 },
  suggestTitle: { fontSize: 18 },
  suggestBody: { fontSize: 13, opacity: 0.85 },
  ctaBtn: { marginTop: 6, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' },
  allocationBar: { flexDirection: 'row', height: 10, marginTop: 8, overflow: 'hidden' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendLabel: { fontSize: 12 },
  comingSoonTitle: { fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  activityRow: { paddingVertical: 10, borderBottomWidth: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 2 },
  activityLabel: { fontSize: 14 },
})

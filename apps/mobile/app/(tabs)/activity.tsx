// File: apps/mobile/app/(tabs)/activity.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, SectionList, TextInput, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/ThemeContext'
import { fonts } from '../../lib/theme'
import Segmented from '../../components/Segmented'
import Tag from '../../components/Tag'

type AccountFilter = 'All' | 'ZAR' | 'USD'

interface ActivityItem {
  id: string
  kind: 'transaction' | 'deposit'
  date: string
  ticker?: string
  accountType: string
  shares?: number
  price?: number
  amount: number
  fees: number
  depositMethod?: string
  notes?: string | null
  tags?: string[] | null
  commission_fee?: number | null
  settlement_admin_fee?: number | null
  ipl_admin_fee?: number | null
  vat_fee?: number | null
  securities_transfer_tax_fee?: number | null
  fx_fee?: number | null
  other_fees?: number | null
}

function totalTxFees(tx: any): number {
  return (tx.commission_fee || 0) + (tx.settlement_admin_fee || 0) + (tx.ipl_admin_fee || 0)
    + (tx.vat_fee || 0) + (tx.securities_transfer_tax_fee || 0) + (tx.fx_fee || 0) + (tx.other_fees || 0)
}

function monthLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function ActivityScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('All')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setError(null)
    try {
      const [{ data: transactions, error: txError }, { data: deposits, error: depError }] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('deposits').select('*').order('date', { ascending: false }),
      ])
      if (txError) throw txError
      if (depError) throw depError

      const txItems: ActivityItem[] = (transactions || []).map((tx: any) => ({
        id: tx.id, kind: 'transaction', date: tx.date, ticker: tx.ticker, accountType: tx.account_type || 'ZAR',
        shares: tx.shares, price: tx.price_at_transaction, amount: tx.shares * tx.price_at_transaction,
        fees: totalTxFees(tx), notes: tx.notes, tags: tx.tags,
        commission_fee: tx.commission_fee, settlement_admin_fee: tx.settlement_admin_fee, ipl_admin_fee: tx.ipl_admin_fee,
        vat_fee: tx.vat_fee, securities_transfer_tax_fee: tx.securities_transfer_tax_fee, fx_fee: tx.fx_fee, other_fees: tx.other_fees,
      }))
      const depItems: ActivityItem[] = (deposits || []).map((d: any) => ({
        id: d.id, kind: 'deposit', date: d.date, accountType: d.account_type,
        amount: d.amount, fees: d.deposit_fee || 0, depositMethod: d.deposit_method,
      }))
      setItems([...txItems, ...depItems].sort((a, b) => +new Date(b.date) - +new Date(a.date)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    let list = accountFilter === 'All' ? items : items.filter((i) => i.accountType === accountFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((i) =>
        (i.ticker || 'deposit').toLowerCase().includes(q) || (i.tags || []).some((t) => t.toLowerCase().includes(q))
      )
    }
    return list
  }, [items, accountFilter, search])

  const sections = useMemo(() => {
    const byMonth = new Map<string, ActivityItem[]>()
    filtered.forEach((item) => {
      const key = monthLabel(item.date)
      if (!byMonth.has(key)) byMonth.set(key, [])
      byMonth.get(key)!.push(item)
    })
    return Array.from(byMonth.entries()).map(([title, data]) => ({ title, data }))
  }, [filtered])

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.heading }]}>Activity</Text>
          <Pressable onPress={() => router.push('/deposits/new')}>
            <Text style={{ color: colors.accent700, fontSize: 12.5 }}>+ Add deposit</Text>
          </Pressable>
        </View>
        <TextInput
          style={[styles.search, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search ticker or tag"
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.headerRow}>
          <Segmented
            options={[{ value: 'All', label: 'All' }, { value: 'ZAR', label: 'ZAR' }, { value: 'USD', label: 'USD' }]}
            value={accountFilter}
            onChange={setAccountFilter}
          />
          <Text style={{ marginLeft: 'auto', color: colors.textMuted, fontSize: 11.5 }}>{filtered.length} of {items.length}</Text>
        </View>
      </View>

      {error && <Text style={{ color: colors.loss, fontSize: 13, padding: 18 }}>{error}</Text>}

      {filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.textMuted }}>No activity found.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 18 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.monthLabel, { color: colors.textMuted }]}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const isExpanded = expanded.has(item.id)
            const isDeposit = item.kind === 'deposit'
            return (
              <View>
                <Pressable
                  style={[styles.row, { borderBottomColor: colors.divider }]}
                  onPress={() => !isDeposit && toggleExpanded(item.id)}
                >
                  <View style={styles.rowTop}>
                    <View style={styles.rowLabelLine}>
                      <Text style={[styles.rowLabel, { color: colors.text, fontFamily: fonts.heading }]}>
                        {isDeposit ? 'Deposit' : item.ticker}
                      </Text>
                      <Tag label={isDeposit ? item.accountType : 'Buy'} variant={isDeposit ? 'neutral' : 'accent'} />
                    </View>
                    <Text style={{ color: colors.text, fontFamily: 'ui-monospace', fontSize: 14 }}>R {item.amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.rowTop}>
                    <Text style={{ color: colors.textMuted, fontFamily: 'ui-monospace', fontSize: 11.5 }}>
                      {new Date(item.date).toLocaleDateString()}
                      {isDeposit ? ` · ${item.depositMethod}` : ` · ${item.shares?.toFixed(6)} sh @ R ${item.price?.toFixed(2)}`}
                    </Text>
                    <Text style={{ color: isExpanded ? colors.accent700 : colors.textMuted, fontFamily: 'ui-monospace', fontSize: 11.5 }}>
                      fees R {item.fees.toFixed(2)} {!isDeposit ? (isExpanded ? '▼' : '▶') : ''}
                    </Text>
                  </View>
                </Pressable>

                {isExpanded && !isDeposit && (
                  <View style={[styles.feeBreakdown, { backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
                    <FeeLine label="Commission" value={item.commission_fee} muted={colors.textMuted} text={colors.text} />
                    <FeeLine label="Settlement & admin" value={item.settlement_admin_fee} muted={colors.textMuted} text={colors.text} />
                    <FeeLine label="Investor protection levy" value={item.ipl_admin_fee} muted={colors.textMuted} text={colors.text} />
                    <FeeLine label="VAT" value={item.vat_fee} muted={colors.textMuted} text={colors.text} />
                    <FeeLine label="Securities transfer tax" value={item.securities_transfer_tax_fee} muted={colors.textMuted} text={colors.text} />
                    {(item.fx_fee || 0) > 0 && <FeeLine label="FX fee" value={item.fx_fee} muted={colors.textMuted} text={colors.text} />}
                    {item.tags && item.tags.length > 0 && (
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Tags: {item.tags.join(', ')}</Text>
                    )}
                    {item.notes && <Text style={{ color: colors.textMuted, fontSize: 12 }}>Note: {item.notes}</Text>}
                  </View>
                )}
              </View>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

function FeeLine({ label, value, muted, text }: { label: string; value?: number | null; muted: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: muted, fontSize: 12.5 }}>{label}</Text>
      <Text style={{ color: text, fontSize: 12.5 }}>R {(value || 0).toFixed(2)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 18, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  headerTop: { flexDirection: 'row', alignItems: 'baseline' },
  title: { fontSize: 26, letterSpacing: -0.3, marginRight: 'auto' },
  search: { borderWidth: 1, minHeight: 40, paddingHorizontal: 12, fontSize: 13 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  monthLabel: { fontFamily: 'ui-monospace', fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', paddingTop: 12, paddingBottom: 6 },
  row: { paddingVertical: 11, borderBottomWidth: 1, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabelLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 15 },
  feeBreakdown: { marginHorizontal: -18, paddingHorizontal: 18, paddingVertical: 12, gap: 6, borderBottomWidth: 1 },
})

// File: apps/mobile/app/(tabs)/transactions.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

type AccountFilter = 'all' | 'ZAR' | 'USD'

interface TransactionRow {
  id: string
  date: string
  ticker: string
  shares: number
  price_at_transaction: number
  account_type: string | null
  tags: string[] | null
  notes: string | null
  commission_fee: number | null
  settlement_admin_fee: number | null
  ipl_admin_fee: number | null
  vat_fee: number | null
  securities_transfer_tax_fee: number | null
  fx_fee: number | null
  other_fees: number | null
}

function totalFees(tx: TransactionRow): number {
  return (tx.commission_fee || 0) + (tx.settlement_admin_fee || 0) + (tx.ipl_admin_fee || 0)
    + (tx.vat_fee || 0) + (tx.securities_transfer_tax_fee || 0) + (tx.fx_fee || 0) + (tx.other_fees || 0)
}

export default function TransactionsScreen() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
      if (fetchError) throw fetchError
      setTransactions((data as TransactionRow[]) || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(
    () => (accountFilter === 'all' ? transactions : transactions.filter((tx) => (tx.account_type || 'ZAR') === accountFilter)),
    [transactions, accountFilter]
  )

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
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
      <View style={styles.headerRow}>
        <Text style={styles.title}>Transactions</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push('/transactions/new')}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.segRow}>
        {(['all', 'ZAR', 'USD'] as AccountFilter[]).map((opt) => (
          <Pressable
            key={opt}
            style={[styles.segOpt, accountFilter === opt && styles.segOptActive]}
            onPress={() => setAccountFilter(opt)}
          >
            <Text style={[styles.segOptText, accountFilter === opt && styles.segOptTextActive]}>
              {opt === 'all' ? 'All' : opt}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.muted}>No transactions found.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(tx) => tx.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
          renderItem={({ item }) => {
            const amount = item.shares * item.price_at_transaction
            const fees = totalFees(item)
            const isExpanded = expanded.has(item.id)
            return (
              <View style={styles.card}>
                <Pressable onPress={() => toggleExpanded(item.id)}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.ticker}>{item.ticker}</Text>
                      <Text style={styles.muted}>{new Date(item.date).toLocaleDateString()} · {item.account_type || 'ZAR'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.amount}>R{(amount + fees).toFixed(2)}</Text>
                      <Text style={styles.muted}>{item.shares.toFixed(6)} sh @ R{item.price_at_transaction.toFixed(2)}</Text>
                    </View>
                  </View>
                  <Text style={styles.feesLine}>Fees: R{fees.toFixed(2)} {isExpanded ? '▼' : '▶'}</Text>
                </Pressable>

                {isExpanded && (
                  <View style={styles.feeBreakdown}>
                    <Text style={styles.feeLine}>Commission: R{(item.commission_fee || 0).toFixed(2)}</Text>
                    <Text style={styles.feeLine}>Settlement & admin: R{(item.settlement_admin_fee || 0).toFixed(2)}</Text>
                    <Text style={styles.feeLine}>Investor protection levy: R{(item.ipl_admin_fee || 0).toFixed(2)}</Text>
                    <Text style={styles.feeLine}>VAT: R{(item.vat_fee || 0).toFixed(2)}</Text>
                    <Text style={styles.feeLine}>Securities transfer tax: R{(item.securities_transfer_tax_fee || 0).toFixed(2)}</Text>
                    {(item.fx_fee || 0) > 0 && <Text style={styles.feeLine}>FX fee: R{(item.fx_fee || 0).toFixed(2)}</Text>}
                    {(item.other_fees || 0) > 0 && <Text style={styles.feeLine}>Other: R{(item.other_fees || 0).toFixed(2)}</Text>}
                    {item.tags && item.tags.length > 0 && (
                      <Text style={styles.feeLine}>Tags: {item.tags.join(', ')}</Text>
                    )}
                    {item.notes && <Text style={styles.feeLine}>Notes: {item.notes}</Text>}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addBtn: { backgroundColor: colors.accent, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  error: { color: colors.loss, fontSize: 13 },
  muted: { fontSize: 12, color: colors.textMuted },
  segRow: { flexDirection: 'row', gap: 8 },
  segOpt: { paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  segOptActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segOptText: { fontSize: 13, color: colors.text },
  segOptTextActive: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ticker: { fontSize: 16, fontWeight: '600' },
  amount: { fontSize: 16, fontWeight: '600' },
  feesLine: { fontSize: 12, color: colors.textMuted },
  feeBreakdown: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 4 },
  feeLine: { fontSize: 12, color: colors.text },
})

// File: apps/mobile/app/deposits/index.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

type AccountFilter = 'all' | 'ZAR' | 'USD'

interface DepositRow {
  id: string
  amount: number
  date: string
  account_type: string
  deposit_method: string
  deposit_fee: number
  description: string | null
}

export default function DepositsScreen() {
  const router = useRouter()
  const [deposits, setDeposits] = useState<DepositRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all')

  const load = useCallback(async () => {
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('deposits')
        .select('*')
        .order('date', { ascending: false })
      if (fetchError) throw fetchError
      setDeposits((data as DepositRow[]) || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deposits')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(
    () => (accountFilter === 'all' ? deposits : deposits.filter((d) => d.account_type === accountFilter)),
    [deposits, accountFilter]
  )

  const total = filtered.reduce((sum, d) => sum + d.amount, 0)

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Deposits' }} />

      <Pressable style={styles.addBtn} onPress={() => router.push('/deposits/new')}>
        <Text style={styles.addBtnText}>+ Add Deposit</Text>
      </Pressable>

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

      <Text style={styles.muted}>Total: R{total.toFixed(2)} across {filtered.length} deposit{filtered.length === 1 ? '' : 's'}</Text>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.muted}>No deposits yet. Add one from the web app.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => d.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.amount}>R{item.amount.toFixed(2)}</Text>
                  <Text style={styles.muted}>{new Date(item.date).toLocaleDateString()} · {item.account_type} · {item.deposit_method}</Text>
                </View>
                {item.deposit_fee > 0 && <Text style={styles.muted}>Fee: R{item.deposit_fee.toFixed(2)}</Text>}
              </View>
              {item.description && <Text style={styles.muted}>{item.description}</Text>}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.loss, fontSize: 13 },
  addBtn: { backgroundColor: colors.accent, padding: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  muted: { fontSize: 12, color: colors.textMuted },
  segRow: { flexDirection: 'row', gap: 8 },
  segOpt: { paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  segOptActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segOptText: { fontSize: 13, color: colors.text },
  segOptTextActive: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  amount: { fontSize: 16, fontWeight: '600' },
})

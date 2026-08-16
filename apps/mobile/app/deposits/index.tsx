// File: apps/mobile/app/deposits/index.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/ThemeContext'
import { fonts } from '../../lib/theme'
import Segmented from '../../components/Segmented'
import Tag from '../../components/Tag'
import Button from '../../components/Button'

type AccountFilter = 'All' | 'ZAR' | 'USD'

interface DepositRow {
  id: string
  amount: number
  date: string
  account_type: string
  movement_type: string
  deposit_method: string
  deposit_fee: number
  description: string | null
}

export default function DepositsScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const [deposits, setDeposits] = useState<DepositRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('All')

  const load = useCallback(async () => {
    setError(null)
    try {
      const { data, error: fetchError } = await supabase.from('deposits').select('*').order('date', { ascending: false })
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
    () => (accountFilter === 'All' ? deposits : deposits.filter((d) => d.account_type === accountFilter)),
    [deposits, accountFilter]
  )
  const netTotal = filtered.reduce((sum, d) => sum + (d.movement_type === 'withdrawal' ? -d.amount : d.amount), 0)

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <View style={styles.headerTop}>
          <Text style={{ color: colors.accent700, fontSize: 12.5 }} onPress={() => router.back()}>← Back</Text>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.heading }]}>Deposits &amp; Withdrawals</Text>
          <Text style={{ fontSize: 12.5, opacity: 0 }}>—</Text>
        </View>
        <Segmented
          options={[{ value: 'All', label: 'All' }, { value: 'ZAR', label: 'ZAR' }, { value: 'USD', label: 'USD' }]}
          value={accountFilter}
          onChange={setAccountFilter}
        />
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          Net: R {netTotal.toFixed(2)} across {filtered.length} movement{filtered.length === 1 ? '' : 's'}
        </Text>
      </View>

      <View style={{ padding: 18, paddingBottom: 0, flexDirection: 'row', gap: 10 }}>
        <Button label="+ Add Deposit" variant="primary" onPress={() => router.push('/transactions/new?kind=deposit')} style={{ flex: 1 }} />
        <Button label="+ Add Withdrawal" variant="secondary" onPress={() => router.push('/transactions/new?kind=withdrawal')} style={{ flex: 1 }} />
      </View>

      {error && <Text style={{ color: colors.loss, fontSize: 13, padding: 18 }}>{error}</Text>}

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.textMuted }}>No deposits yet.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ padding: 18 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
          renderItem={({ item }) => {
            const isWithdrawal = item.movement_type === 'withdrawal'
            return (
              <Pressable
                style={({ pressed }) => [styles.row, { borderBottomColor: colors.divider }, pressed && { opacity: 0.6 }]}
                onPress={() => router.push(`/deposits/${item.id}/edit`)}
              >
                <View style={styles.rowTop}>
                  <View>
                    <Text style={{ color: colors.text, fontFamily: 'ui-monospace', fontSize: 16, fontWeight: '600' }}>
                      {isWithdrawal ? '−' : ''}R {item.amount.toFixed(2)}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontFamily: 'ui-monospace', fontSize: 11.5 }}>{new Date(item.date).toLocaleDateString()}</Text>
                  </View>
                  <Tag
                    label={isWithdrawal ? `${item.account_type} · Withdrawal` : `${item.account_type} · ${item.deposit_method}`}
                    variant={isWithdrawal ? 'outline' : 'neutral'}
                  />
                </View>
                {item.deposit_fee > 0 && <Text style={{ color: colors.textMuted, fontSize: 12 }}>Fee: R {item.deposit_fee.toFixed(2)}</Text>}
                {item.description && <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.description}</Text>}
              </Pressable>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 18, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 19, letterSpacing: 0.3, marginLeft: 'auto', marginRight: 'auto' },
  row: { paddingVertical: 12, borderBottomWidth: 1, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
})

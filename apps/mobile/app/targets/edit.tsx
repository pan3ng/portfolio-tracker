// File: apps/mobile/app/targets/edit.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'
import { validateTargetsSumTo100 } from '@portfolio-tracker/api-client'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

type AccountType = 'ZAR' | 'USD'

interface TargetRow {
  ticker: string
  target_weight_pct: number
  account_type: AccountType
}

export default function EditTargetsScreen() {
  const router = useRouter()
  const [accountFilter, setAccountFilter] = useState<AccountType>('ZAR')
  const [allTargets, setAllTargets] = useState<TargetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('targets')
      .select('*')
      .order('ticker', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setAllTargets(
            (data || []).map((t: any) => ({
              ticker: t.ticker,
              target_weight_pct: t.target_weight_pct,
              account_type: (t.account_type || 'ZAR') as AccountType,
            }))
          )
        }
        setLoading(false)
      })
  }, [])

  const targets = allTargets.filter((t) => t.account_type === accountFilter)
  const validation = validateTargetsSumTo100(targets)

  const addRow = () => {
    setAllTargets([...allTargets, { ticker: '', target_weight_pct: 0, account_type: accountFilter }])
  }

  const removeRow = (index: number) => {
    const target = targets[index]
    setAllTargets(allTargets.filter((t) => t !== target))
  }

  const updateRow = (index: number, field: 'ticker' | 'target_weight_pct', value: string) => {
    const target = targets[index]
    const allIndex = allTargets.indexOf(target)
    if (allIndex === -1) return
    const updated = [...allTargets]
    if (field === 'ticker') {
      updated[allIndex] = { ...updated[allIndex], ticker: value.toUpperCase() }
    } else {
      updated[allIndex] = { ...updated[allIndex], target_weight_pct: parseFloat(value) || 0 }
    }
    setAllTargets(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const emptyTickers = allTargets.filter((t) => !t.ticker.trim())
      if (emptyTickers.length > 0) throw new Error('All tickers must be filled in')

      const zarTargets = allTargets.filter((t) => t.account_type === 'ZAR')
      const usdTargets = allTargets.filter((t) => t.account_type === 'USD')

      if (zarTargets.length > 0) {
        const v = validateTargetsSumTo100(zarTargets)
        if (!v.valid) throw new Error(`ZAR target weights must sum to 100%. Current sum: ${v.sum.toFixed(2)}%`)
      }
      if (usdTargets.length > 0) {
        const v = validateTargetsSumTo100(usdTargets)
        if (!v.valid) throw new Error(`USD target weights must sum to 100%. Current sum: ${v.sum.toFixed(2)}%`)
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: deleteError } = await supabase.from('targets').delete().eq('user_id', user.id)
      if (deleteError) throw deleteError

      if (allTargets.length > 0) {
        const { error: insertError } = await supabase.from('targets').insert(
          allTargets.map((t) => ({ user_id: user.id, ticker: t.ticker, target_weight_pct: t.target_weight_pct, account_type: t.account_type }))
        )
        if (insertError) throw insertError
      }

      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save targets')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <Stack.Screen options={{ headerShown: true, title: 'Edit Targets' }} />
        <ActivityIndicator />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Edit Targets' }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.segRow}>
          {(['ZAR', 'USD'] as AccountType[]).map((opt) => (
            <Pressable
              key={opt}
              style={[styles.segOpt, accountFilter === opt && styles.segOptActive]}
              onPress={() => setAccountFilter(opt)}
            >
              <Text style={[styles.segOptText, accountFilter === opt && styles.segOptTextActive]}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        {targets.map((t, index) => (
          <View key={index} style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 2 }]}
              value={t.ticker}
              onChangeText={(v) => updateRow(index, 'ticker', v)}
              placeholder="Ticker"
              autoCapitalize="characters"
              editable={!saving}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={t.target_weight_pct ? t.target_weight_pct.toString() : ''}
              onChangeText={(v) => updateRow(index, 'target_weight_pct', v)}
              keyboardType="decimal-pad"
              placeholder="%"
              editable={!saving}
            />
            <Pressable style={styles.removeBtn} onPress={() => removeRow(index)} disabled={saving}>
              <Text style={styles.removeBtnText}>✕</Text>
            </Pressable>
          </View>
        ))}

        <Pressable style={styles.secondaryBtn} onPress={addRow} disabled={saving}>
          <Text style={styles.secondaryBtnText}>+ Add ticker</Text>
        </Pressable>

        <View style={[styles.sumRow, validation.valid ? styles.sumValid : styles.sumInvalid]}>
          <Text style={styles.sumText}>
            {accountFilter} total: {validation.sum.toFixed(2)}% {validation.valid ? '✓' : '(must sum to 100%)'}
          </Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable style={styles.secondaryBtnFlex} onPress={() => router.back()} disabled={saving}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.primaryBtn, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save Targets</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 12 },
  error: { fontSize: 13, color: colors.loss },
  muted: { fontSize: 12, color: colors.textMuted },
  input: { borderWidth: 1, borderColor: colors.border, padding: 10, fontSize: 14, backgroundColor: colors.surface },
  segRow: { flexDirection: 'row', gap: 8 },
  segOpt: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  segOptActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segOptText: { fontSize: 14, color: colors.text },
  segOptTextActive: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  removeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  removeBtnText: { fontSize: 16, color: colors.loss },
  secondaryBtn: { borderWidth: 1, borderColor: colors.border, padding: 12, alignItems: 'center', backgroundColor: colors.surface },
  secondaryBtnFlex: { flex: 1, borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  secondaryBtnText: { fontWeight: '600', fontSize: 14, color: colors.text },
  primaryBtn: { flex: 2, backgroundColor: colors.accent, padding: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  disabled: { opacity: 0.5 },
  sumRow: { padding: 10, borderWidth: 1 },
  sumValid: { borderColor: colors.gain, backgroundColor: 'rgba(63,122,92,0.08)' },
  sumInvalid: { borderColor: colors.loss, backgroundColor: 'rgba(157,95,104,0.08)' },
  sumText: { fontSize: 13, fontWeight: '600', color: colors.text },
})

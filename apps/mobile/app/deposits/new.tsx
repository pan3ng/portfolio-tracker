// File: apps/mobile/app/deposits/new.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

type AccountType = 'ZAR' | 'USD'
type DepositMethod = 'card' | 'eft'

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

export default function NewDepositScreen() {
  const router = useRouter()

  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [accountType, setAccountType] = useState<AccountType>('ZAR')
  const [method, setMethod] = useState<DepositMethod>('card')
  const [description, setDescription] = useState('')

  const [cardPct, setCardPct] = useState(2.0)
  const [eftPct, setEftPct] = useState(0.0)
  const [feeManuallySet, setFeeManuallySet] = useState(false)
  const [depositFee, setDepositFee] = useState(0)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()
      if (data) {
        setCardPct(data.default_card_deposit_pct)
        setEftPct(data.default_eft_deposit_pct)
      }
    })
  }, [])

  useEffect(() => {
    if (feeManuallySet) return
    const amountNum = parseFloat(amount) || 0
    const pct = method === 'card' ? cardPct : eftPct
    setDepositFee((amountNum * pct) / 100)
  }, [amount, method, cardPct, eftPct, feeManuallySet])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const amountNum = parseFloat(amount)
      if (isNaN(amountNum) || amountNum <= 0) throw new Error('Please enter a valid amount')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must be in YYYY-MM-DD format')

      const { error: insertError } = await supabase.from('deposits').insert({
        user_id: user.id,
        amount: amountNum,
        date: new Date(date).toISOString(),
        account_type: accountType,
        deposit_method: method,
        deposit_fee: depositFee,
        description: description.trim() || null,
      })
      if (insertError) throw insertError

      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save deposit')
    } finally {
      setSaving(false)
    }
  }

  const currencySymbol = accountType === 'USD' ? '$' : 'R'

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Add Deposit' }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>Amount ({accountType})</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={`${currencySymbol} 1000.00`}
            editable={!saving}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            editable={!saving}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Account</Text>
          <View style={styles.segRow}>
            {(['ZAR', 'USD'] as AccountType[]).map((opt) => (
              <Pressable
                key={opt}
                style={[styles.segOpt, accountType === opt && styles.segOptActive]}
                onPress={() => setAccountType(opt)}
              >
                <Text style={[styles.segOptText, accountType === opt && styles.segOptTextActive]}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Deposit method</Text>
          <View style={styles.segRow}>
            {(['card', 'eft'] as DepositMethod[]).map((opt) => (
              <Pressable
                key={opt}
                style={[styles.segOpt, method === opt && styles.segOptActive]}
                onPress={() => setMethod(opt)}
              >
                <Text style={[styles.segOptText, method === opt && styles.segOptTextActive]}>{opt === 'card' ? 'Card' : 'EFT'}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Deposit fee ({currencySymbol})</Text>
          <TextInput
            style={styles.input}
            value={depositFee.toFixed(2)}
            onChangeText={(v) => { setFeeManuallySet(true); setDepositFee(parseFloat(v) || 0) }}
            keyboardType="decimal-pad"
            editable={!saving}
          />
          <Text style={styles.muted}>
            Auto-calculated at {method === 'card' ? cardPct : eftPct}% ({method}). Edit to override.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g., Monthly transfer"
            editable={!saving}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable style={styles.secondaryBtn} onPress={() => router.back()} disabled={saving}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, { flex: 2 }, (!amount || saving) && styles.disabled]}
            onPress={handleSave}
            disabled={!amount || saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save deposit</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted },
  error: { fontSize: 13, color: colors.loss },
  input: { borderWidth: 1, borderColor: colors.border, padding: 12, fontSize: 15, backgroundColor: colors.surface },
  segRow: { flexDirection: 'row', gap: 8 },
  segOpt: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  segOptActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segOptText: { fontSize: 14, color: colors.text },
  segOptTextActive: { color: '#fff', fontWeight: '600' },
  primaryBtn: { backgroundColor: colors.accent, padding: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  secondaryBtnText: { fontWeight: '600', fontSize: 15, color: colors.text },
  disabled: { opacity: 0.5 },
})

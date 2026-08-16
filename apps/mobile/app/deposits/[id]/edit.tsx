// File: apps/mobile/app/deposits/[id]/edit.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { useTheme } from '../../../lib/ThemeContext'
import { fonts } from '../../../lib/theme'
import Segmented from '../../../components/Segmented'
import Button from '../../../components/Button'

type AccountType = 'ZAR' | 'USD'
type DepositMethod = 'card' | 'eft'

export default function EditDepositScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('ZAR')
  const [method, setMethod] = useState<DepositMethod>('card')
  const [description, setDescription] = useState('')
  const [depositFee, setDepositFee] = useState(0)

  const [cardPct, setCardPct] = useState(2.0)
  const [eftPct, setEftPct] = useState(0.0)

  const [loadingDeposit, setLoadingDeposit] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
    if (!id) return
    supabase.from('deposits').select('*').eq('id', id).single().then(({ data, error: fetchError }) => {
      if (fetchError || !data) {
        setError(fetchError?.message || 'Deposit not found')
        setLoadingDeposit(false)
        return
      }
      setAmount(data.amount.toString())
      setDate(new Date(data.date).toISOString().split('T')[0])
      setAccountType((data.account_type || 'ZAR') as AccountType)
      setMethod((data.deposit_method || 'card') as DepositMethod)
      setDescription(data.description || '')
      // Preserve the deposit's saved fee rather than auto-recalculating it on load.
      setDepositFee(data.deposit_fee || 0)
      setLoadingDeposit(false)
    })
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const amountNum = parseFloat(amount)
      if (isNaN(amountNum) || amountNum <= 0) throw new Error('Please enter a valid amount')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must be in YYYY-MM-DD format')

      const { error: updateError } = await supabase.from('deposits').update({
        amount: amountNum,
        date: new Date(date).toISOString(),
        account_type: accountType,
        deposit_method: method,
        deposit_fee: depositFee,
        description: description.trim() || null,
      }).eq('id', id)
      if (updateError) throw updateError

      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update deposit')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      const { error: deleteError } = await supabase.from('deposits').delete().eq('id', id)
      if (deleteError) throw deleteError
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete deposit')
      setDeleting(false)
    }
  }

  const currencySymbol = accountType === 'USD' ? '$' : 'R'

  if (loadingDeposit) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <Text style={{ color: colors.accent700, fontSize: 12.5 }} onPress={() => router.back()}>Cancel</Text>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.heading }]}>Edit Deposit</Text>
        <Text style={{ fontSize: 12.5, opacity: 0 }}>—</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Amount ({accountType})</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={`${currencySymbol} 1000.00`}
            placeholderTextColor={colors.textMuted}
            editable={!saving && !deleting}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Date</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            editable={!saving && !deleting}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Account</Text>
          <Segmented block size="md" options={[{ value: 'ZAR', label: 'ZAR' }, { value: 'USD', label: 'USD' }]} value={accountType} onChange={(v) => setAccountType(v as AccountType)} />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Deposit method</Text>
          <Segmented block size="md" options={[{ value: 'card', label: 'Card' }, { value: 'eft', label: 'EFT' }]} value={method} onChange={(v) => setMethod(v as DepositMethod)} />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Deposit fee ({currencySymbol})</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
            value={depositFee.toFixed(2)}
            onChangeText={(v) => setDepositFee(parseFloat(v) || 0)}
            keyboardType="decimal-pad"
            editable={!saving && !deleting}
          />
          <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>
            Auto-calculated at {method === 'card' ? cardPct : eftPct}% ({method}) for new deposits. Edit to override.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Description</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g., Monthly transfer"
            placeholderTextColor={colors.textMuted}
            editable={!saving && !deleting}
          />
        </View>

        {error && <Text style={{ color: colors.loss, fontSize: 13 }}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        <Button label="Cancel" variant="secondary" onPress={() => router.back()} disabled={saving || deleting} style={{ flex: 1 }} />
        <Button label={deleting ? '' : 'Delete'} loading={deleting} variant="secondary" onPress={handleDelete} disabled={saving || deleting} style={{ flex: 1, borderColor: colors.loss }} />
        <Button label="Save" variant="primary" onPress={handleSave} disabled={!amount || saving || deleting} loading={saving} style={{ flex: 1 }} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 19, letterSpacing: 0.3, marginLeft: 'auto', marginRight: 'auto' },
  scroll: { padding: 18, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, padding: 12, fontSize: 15 },
  footer: { padding: 14, borderTopWidth: 1, flexDirection: 'row', gap: 10 },
})

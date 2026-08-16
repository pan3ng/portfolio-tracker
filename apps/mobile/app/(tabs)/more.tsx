// File: apps/mobile/app/(tabs)/more.tsx
import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/ThemeContext'
import { fonts } from '../../lib/theme'
import Button from '../../components/Button'

export default function MoreScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const [email, setEmail] = useState<string | null>(null)
  const [cashReady, setCashReady] = useState<number | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    supabase.from('deposits').select('amount, movement_type').then(({ data }) => {
      if (data) setCashReady(data.reduce((s, d) => s + (d.movement_type === 'withdrawal' ? -d.amount : d.amount), 0))
    })
  }, [])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <Text style={[styles.kicker, { color: colors.textMuted }]}>More</Text>

      <MenuRow label="Plan — target weights" onPress={() => router.push('/plan')} colors={colors} />
      <MenuRow
        label="Deposits & withdrawals"
        value={cashReady !== null ? `R ${cashReady.toFixed(0)}` : undefined}
        onPress={() => router.push('/deposits')}
        colors={colors}
      />
      <MenuRow label="Import a CSV" value="Coming soon" disabled onPress={() => {}} colors={colors} />
      <MenuRow label="Settings" onPress={() => router.push('/settings')} colors={colors} />

      <View style={[styles.accountRow, { borderBottomColor: colors.divider }]}>
        <Text style={{ color: colors.textMuted, fontSize: 15 }} numberOfLines={1}>{email || ''}</Text>
        <Button label="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
      </View>
    </SafeAreaView>
  )
}

function MenuRow({
  label, value, onPress, disabled, colors,
}: {
  label: string
  value?: string
  onPress: () => void
  disabled?: boolean
  colors: { text: string; textMuted: string; divider: string }
}) {
  return (
    <Pressable
      style={[styles.row, { borderBottomColor: colors.divider }, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
      {value ? (
        <Text style={{ color: colors.textMuted, fontFamily: 'ui-monospace', fontSize: 13 }}>{value}</Text>
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: 16, opacity: 0.4 }}>→</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 16 },
  kicker: { fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, borderBottomWidth: 1 },
  accountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, gap: 12, marginTop: 4 },
})

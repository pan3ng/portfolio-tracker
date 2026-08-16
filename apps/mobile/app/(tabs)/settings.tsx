// File: apps/mobile/app/(tabs)/settings.tsx
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

export default function SettingsScreen() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)

  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearText, setClearText] = useState('')
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  const handleSignOut = () => {
    supabase.auth.signOut()
  }

  const handleClearData = async () => {
    if (clearText !== 'CLEAR') return
    setClearing(true)
    setClearError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: txError } = await supabase.from('transactions').delete().eq('user_id', user.id)
      if (txError) throw txError
      const { error: targetsError } = await supabase.from('targets').delete().eq('user_id', user.id)
      if (targetsError) throw targetsError
      const { error: depositsError } = await supabase.from('deposits').delete().eq('user_id', user.id)
      if (depositsError) throw depositsError
      const { error: settingsError } = await supabase.from('user_settings').delete().eq('user_id', user.id)
      if (settingsError) throw settingsError

      setShowClearConfirm(false)
      setClearText('')
      router.replace('/')
    } catch (err) {
      setClearError(err instanceof Error ? err.message : 'Failed to clear data')
    } finally {
      setClearing(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteText !== 'DELETE') return
    setDeleting(true)
    setDeleteError(null)
    try {
      const { error } = await supabase.functions.invoke('delete-account')
      if (error) throw error
      await supabase.auth.signOut()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account')
      setDeleting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      {email && <Text style={styles.muted}>Signed in as {email}</Text>}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cash deposits</Text>
        <Text style={styles.muted}>Track cash deposited into your accounts to calculate uninvested capital.</Text>
        <Pressable style={styles.secondaryBtn} onPress={() => router.push('/deposits')}>
          <Text style={styles.secondaryBtnText}>View Deposits</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Pressable style={styles.secondaryBtn} onPress={handleSignOut}>
          <Text style={styles.secondaryBtnText}>Sign out</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { borderColor: colors.loss }]}>
        <Text style={[styles.cardTitle, { color: colors.loss }]}>Danger Zone</Text>

        <View style={{ gap: 8 }}>
          <Text style={styles.dangerLabel}>Clear My Data</Text>
          <Text style={styles.muted}>
            Deletes all transactions, targets, deposits, and fee settings. Your login stays active.
          </Text>
          {!showClearConfirm ? (
            <Pressable style={styles.dangerBtn} onPress={() => setShowClearConfirm(true)}>
              <Text style={styles.dangerBtnText}>Clear My Data</Text>
            </Pressable>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={styles.muted}>Type CLEAR to confirm</Text>
              <TextInput
                style={styles.input}
                value={clearText}
                onChangeText={setClearText}
                editable={!clearing}
                autoCapitalize="characters"
              />
              {clearError && <Text style={styles.error}>{clearError}</Text>}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  style={[styles.dangerBtnFilled, (clearText !== 'CLEAR' || clearing) && styles.disabled]}
                  onPress={handleClearData}
                  disabled={clearText !== 'CLEAR' || clearing}
                >
                  {clearing ? <ActivityIndicator color="#fff" /> : <Text style={styles.dangerBtnFilledText}>Confirm: Clear My Data</Text>}
                </Pressable>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => { setShowClearConfirm(false); setClearText(''); setClearError(null) }}
                  disabled={clearing}
                >
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={styles.hr} />

        <View style={{ gap: 8 }}>
          <Text style={styles.dangerLabel}>Delete My Account</Text>
          <Text style={styles.muted}>Permanently deletes your account and all data. This cannot be undone.</Text>
          {!showDeleteConfirm ? (
            <Pressable style={styles.dangerBtn} onPress={() => setShowDeleteConfirm(true)}>
              <Text style={styles.dangerBtnText}>Delete My Account</Text>
            </Pressable>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={styles.muted}>Type DELETE to confirm</Text>
              <TextInput
                style={styles.input}
                value={deleteText}
                onChangeText={setDeleteText}
                editable={!deleting}
                autoCapitalize="characters"
              />
              {deleteError && <Text style={styles.error}>{deleteError}</Text>}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  style={[styles.dangerBtnFilled, (deleteText !== 'DELETE' || deleting) && styles.disabled]}
                  onPress={handleDeleteAccount}
                  disabled={deleteText !== 'DELETE' || deleting}
                >
                  {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.dangerBtnFilledText}>Confirm: Delete My Account</Text>}
                </Pressable>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => { setShowDeleteConfirm(false); setDeleteText(''); setDeleteError(null) }}
                  disabled={deleting}
                >
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  muted: { fontSize: 12, color: colors.textMuted },
  error: { fontSize: 12, color: colors.loss },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  hr: { height: 1, backgroundColor: colors.border },
  dangerLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  secondaryBtn: { borderWidth: 1, borderColor: colors.border, padding: 12, alignItems: 'center', backgroundColor: colors.surface },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: colors.text },
  dangerBtn: { borderWidth: 1, borderColor: colors.loss, padding: 12, alignItems: 'center' },
  dangerBtnText: { fontSize: 14, fontWeight: '600', color: colors.loss },
  dangerBtnFilled: { flex: 1, backgroundColor: colors.loss, padding: 12, alignItems: 'center', justifyContent: 'center' },
  dangerBtnFilledText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  disabled: { opacity: 0.5 },
  input: { borderWidth: 1, borderColor: colors.border, padding: 10, fontSize: 15, backgroundColor: colors.surface },
})

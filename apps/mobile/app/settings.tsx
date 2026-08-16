// File: apps/mobile/app/settings.tsx
import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { fonts } from '../lib/theme'
import BlueprintCard from '../components/BlueprintCard'
import Segmented from '../components/Segmented'
import Button from '../components/Button'

export default function SettingsScreen() {
  const router = useRouter()
  const { colors, preference, setPreference } = useTheme()

  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearText, setClearText] = useState('')
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <Text style={{ color: colors.accent700, fontSize: 12.5 }} onPress={() => router.back()}>← Back</Text>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.heading }]}>Settings</Text>
        <Text style={{ fontSize: 12.5, opacity: 0 }}>—</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title="Appearance" colors={colors}>
          <Segmented
            block
            size="md"
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'Device' },
            ]}
            value={preference}
            onChange={(v) => setPreference(v as 'light' | 'dark' | 'system')}
          />
        </Section>

        <Section title="Cash deposits & withdrawals" colors={colors}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>Track cash moving in and out of your accounts to calculate uninvested capital.</Text>
          <Button label="View Deposits & Withdrawals" variant="primary" onPress={() => router.push('/deposits')} block />
        </Section>

        <View style={[styles.dangerCard, { borderColor: colors.loss }]}>
          <Text style={[styles.dangerHeading, { color: colors.loss, fontFamily: fonts.heading }]}>Danger Zone</Text>

          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14 }}>Clear My Data</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              Deletes all transactions, targets, deposits, and fee settings. Your login stays active.
            </Text>
            {!showClearConfirm ? (
              <Button label="Clear My Data" variant="secondary" onPress={() => setShowClearConfirm(true)} style={{ borderColor: colors.loss }} />
            ) : (
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>Type CLEAR to confirm</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
                  value={clearText}
                  onChangeText={setClearText}
                  editable={!clearing}
                  autoCapitalize="characters"
                />
                {clearError && <Text style={{ color: colors.loss, fontSize: 12 }}>{clearError}</Text>}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={[styles.dangerBtnFilled, { backgroundColor: colors.loss }, (clearText !== 'CLEAR' || clearing) && { opacity: 0.5 }]}
                    onPress={handleClearData}
                    disabled={clearText !== 'CLEAR' || clearing}
                  >
                    {clearing ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: fonts.heading, fontSize: 14 }}>Confirm: Clear My Data</Text>}
                  </Pressable>
                  <Button
                    label="Cancel"
                    variant="secondary"
                    onPress={() => { setShowClearConfirm(false); setClearText(''); setClearError(null) }}
                    disabled={clearing}
                  />
                </View>
              </View>
            )}
          </View>

          <View style={[styles.hr, { backgroundColor: colors.divider }]} />

          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14 }}>Delete My Account</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Permanently deletes your account and all data. This cannot be undone.</Text>
            {!showDeleteConfirm ? (
              <Button label="Delete My Account" variant="secondary" onPress={() => setShowDeleteConfirm(true)} style={{ borderColor: colors.loss }} />
            ) : (
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>Type DELETE to confirm</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
                  value={deleteText}
                  onChangeText={setDeleteText}
                  editable={!deleting}
                  autoCapitalize="characters"
                />
                {deleteError && <Text style={{ color: colors.loss, fontSize: 12 }}>{deleteError}</Text>}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={[styles.dangerBtnFilled, { backgroundColor: colors.loss }, (deleteText !== 'DELETE' || deleting) && { opacity: 0.5 }]}
                    onPress={handleDeleteAccount}
                    disabled={deleteText !== 'DELETE' || deleting}
                  >
                    {deleting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: fonts.heading, fontSize: 14 }}>Confirm: Delete My Account</Text>}
                  </Pressable>
                  <Button
                    label="Cancel"
                    variant="secondary"
                    onPress={() => { setShowDeleteConfirm(false); setDeleteText(''); setDeleteError(null) }}
                    disabled={deleting}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: { text: string; divider: string } }) {
  return (
    <View style={[styles.section, { borderTopColor: colors.divider }]}>
      <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.heading }]}>{title}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 19, letterSpacing: 0.3, marginLeft: 'auto', marginRight: 'auto' },
  scroll: { padding: 18, gap: 18 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' },
  dangerCard: { borderWidth: 1, padding: 18, gap: 14 },
  dangerHeading: { fontSize: 17 },
  hr: { height: 1 },
  input: { borderWidth: 1, padding: 10, fontSize: 14 },
  dangerBtnFilled: { flex: 1, padding: 12, alignItems: 'center', justifyContent: 'center' },
})

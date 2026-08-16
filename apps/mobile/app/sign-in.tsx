// File: apps/mobile/app/sign-in.tsx
import { useState } from 'react'
import { View, Text, TextInput, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { makeRedirectUri } from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '../lib/supabase'
import { createSessionFromUrl } from '../lib/auth'
import { useTheme } from '../lib/ThemeContext'
import { fonts } from '../lib/theme'
import Button from '../components/Button'

const redirectTo = makeRedirectUri()

export default function SignInScreen() {
  const { colors } = useTheme()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMagicLink = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      })
      if (error) throw error

      const res = await WebBrowser.openAuthSessionAsync(data?.url ?? '', redirectTo)
      if (res.type === 'success') {
        await createSessionFromUrl(res.url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGoogleLoading(false)
    }
  }

  if (sent) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.heading }]}>Check your email</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>We sent a sign-in link to {email}. It works once and expires shortly.</Text>
        <Button label="Use a different email" variant="secondary" onPress={() => setSent(false)} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.brand, { color: colors.text, fontFamily: fonts.heading }]}>HOLDFOLIO</Text>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.heading }]}>Sign in</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>We'll email you a link. No password to remember, nothing to reset.</Text>

      <TextInput
        style={[styles.input, { borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text }]}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.co.za"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />

      {error && <Text style={{ color: colors.loss, fontSize: 13 }}>{error}</Text>}

      <Button label="Email me a link" variant="primary" onPress={handleMagicLink} disabled={loading || !email} loading={loading} block />

      <View style={styles.dividerRow}>
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
      </View>

      <Button label="Continue with Google" variant="secondary" onPress={handleGoogle} disabled={googleLoading} loading={googleLoading} block />

      <Text style={[styles.footnote, { color: colors.textMuted }]}>Your holdings are private to your account. We never see your broker login.</Text>

      {__DEV__ && (
        <Text selectable style={[styles.debug, { color: colors.textMuted }]}>Redirect URL (add to Supabase → Auth → URL Configuration): {redirectTo}</Text>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  brand: { fontSize: 18, letterSpacing: 1, marginBottom: 8 },
  title: { fontSize: 28 },
  subtitle: { fontSize: 14 },
  input: { borderWidth: 1, padding: 12, fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  footnote: { fontSize: 12 },
  debug: { fontSize: 10, fontFamily: 'monospace' },
})

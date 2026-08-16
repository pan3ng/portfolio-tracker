// File: apps/mobile/app/sign-in.tsx
import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { makeRedirectUri } from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '../lib/supabase'
import { createSessionFromUrl } from '../lib/auth'

const redirectTo = makeRedirectUri()

export default function SignInScreen() {
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
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>We sent a sign-in link to {email}. It works once and expires shortly.</Text>
        <Pressable style={styles.secondaryButton} onPress={() => setSent(false)}>
          <Text style={styles.secondaryButtonText}>Use a different email</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.brand}>Portfolio Tracker</Text>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>We'll email you a link. No password to remember, nothing to reset.</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.co.za"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.primaryButton} onPress={handleMagicLink} disabled={loading || !email}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Email me a link</Text>}
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.divider} />
      </View>

      <Pressable style={styles.secondaryButton} onPress={handleGoogle} disabled={googleLoading}>
        {googleLoading ? <ActivityIndicator /> : <Text style={styles.secondaryButtonText}>Continue with Google</Text>}
      </Pressable>

      <Text style={styles.footnote}>Your holdings are private to your account. We never see your broker login.</Text>

      {__DEV__ && (
        <Text selectable style={styles.debug}>Redirect URL (add to Supabase → Auth → URL Configuration): {redirectTo}</Text>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: '#f2f2f3' },
  brand: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14, opacity: 0.7 },
  input: { borderWidth: 1, borderColor: '#c9c9cc', padding: 12, fontSize: 16, backgroundColor: '#fff' },
  primaryButton: { backgroundColor: '#5980a6', padding: 14, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  secondaryButton: { borderWidth: 1, borderColor: '#c9c9cc', padding: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontWeight: '600', fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { flex: 1, height: 1, backgroundColor: '#c9c9cc' },
  dividerText: { fontSize: 11, letterSpacing: 1, opacity: 0.5, textTransform: 'uppercase' },
  footnote: { fontSize: 12, opacity: 0.55 },
  error: { color: '#9d5f68', fontSize: 13 },
  debug: { fontSize: 10, opacity: 0.4, fontFamily: 'monospace' },
})

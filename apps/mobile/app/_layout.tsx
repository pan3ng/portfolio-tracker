// File: apps/mobile/app/_layout.tsx
import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { createSessionFromUrl } from '../lib/auth'

WebBrowser.maybeCompleteAuthSession()

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setChecked(true)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  // Magic-link / OAuth redirects land here as a deep link into the app.
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      createSessionFromUrl(url).catch((err) => console.error('Failed to complete sign-in:', err))
    }
    const subscription = Linking.addEventListener('url', handleUrl)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url })
    })
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    if (!checked) return
    const onSignIn = segments[0] === 'sign-in'
    if (!session && !onSignIn) {
      router.replace('/sign-in')
    } else if (session && onSignIn) {
      router.replace('/')
    }
  }, [checked, session, segments])

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  )
}

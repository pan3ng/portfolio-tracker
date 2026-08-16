// File: apps/mobile/app/_layout.tsx
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts, Barlow_400Regular, Barlow_500Medium, Barlow_700Bold } from '@expo-google-fonts/barlow'
import { BarlowCondensed_400Regular, BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { createSessionFromUrl } from '../lib/auth'
import { ThemeProvider, useTheme } from '../lib/ThemeContext'

WebBrowser.maybeCompleteAuthSession()

function RootNavigator() {
  const router = useRouter()
  const segments = useSegments()
  const { colors } = useTheme()
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
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_700Bold,
    BarlowCondensed_400Regular,
    BarlowCondensed_600SemiBold,
  })

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#f2f2f3' }} />
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

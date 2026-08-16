// File: apps/mobile/lib/ThemeContext.tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { palettes, type Palette } from './theme'
import { supabase } from './supabase'

type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: 'light' | 'dark'
  preference: ThemePreference
  setPreference: (pref: ThemePreference) => void
  colors: Palette
}

const STORAGE_KEY = 'theme-preference'

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [preference, setPreferenceState] = useState<ThemePreference>('system')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored)
      }
    })
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('user_settings').select('theme').eq('user_id', user.id).single()
      if (data?.theme === 'light' || data?.theme === 'dark' || data?.theme === 'system') {
        setPreferenceState(data.theme)
        AsyncStorage.setItem(STORAGE_KEY, data.theme)
      }
    })
  }, [])

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref)
    AsyncStorage.setItem(STORAGE_KEY, pref)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('user_settings').upsert({ user_id: user.id, theme: pref }).then()
    })
  }

  const theme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, preference, setPreference, colors: palettes[theme] }),
    [theme, preference]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

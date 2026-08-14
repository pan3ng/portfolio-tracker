// File: apps/web/components/ThemeProvider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')
  const [mounted, setMounted] = useState(false)

  // Get system theme preference
  const getSystemTheme = (): ResolvedTheme => {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  // Resolve theme to light or dark
  const resolveTheme = (t: Theme): ResolvedTheme => {
    if (t === 'system') {
      return getSystemTheme()
    }
    return t
  }

  // Apply theme to document
  const applyTheme = (t: ResolvedTheme) => {
    if (typeof window === 'undefined') return

    const root = document.documentElement
    if (t === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    setResolvedTheme(t)
  }

  // Load theme from user settings
  const loadTheme = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Not authenticated, use system theme
        const systemTheme = getSystemTheme()
        setThemeState('system')
        applyTheme(systemTheme)
        return
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('theme')
        .eq('user_id', user.id)
        .single()

      if (error || !data) {
        // No settings found, default to system
        const systemTheme = getSystemTheme()
        setThemeState('system')
        applyTheme(systemTheme)
        return
      }

      const userTheme = data.theme as Theme
      setThemeState(userTheme)
      const resolved = resolveTheme(userTheme)
      applyTheme(resolved)
    } catch (err) {
      console.error('Failed to load theme:', err)
      const systemTheme = getSystemTheme()
      setThemeState('system')
      applyTheme(systemTheme)
    }
  }

  // Set theme and persist to settings
  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme)
    const resolved = resolveTheme(newTheme)
    applyTheme(resolved)

    // Persist to database
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            theme: newTheme,
            // Provide defaults for required fields in case of INSERT
            default_commission_pct: 0.25,
            default_card_deposit_pct: 2.0,
            default_eft_deposit_pct: 0.0,
            default_fx_pct: 0.5,
          },
          {
            onConflict: 'user_id',
            ignoreDuplicates: false,
          }
        )

      if (error) {
        console.error('Failed to save theme:', error)
      }
    } catch (err) {
      console.error('Failed to save theme:', err)
    }
  }

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        const systemTheme = getSystemTheme()
        applyTheme(systemTheme)
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  // Load theme on mount
  useEffect(() => {
    loadTheme()
    setMounted(true)
  }, [])

  // Prevent flash of unstyled content
  if (!mounted) {
    return null
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

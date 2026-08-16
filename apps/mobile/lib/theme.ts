// File: apps/mobile/lib/theme.ts
// Mirrors the "Industry" design system tokens from
// _ds/industry-*/styles.css (apps/web ships the same values as CSS custom
// properties) — kept in sync by hand since RN has no CSS custom properties.

export const fonts = {
  heading: 'BarlowCondensed_600SemiBold',
  headingRegular: 'BarlowCondensed_400Regular',
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodyBold: 'Barlow_700Bold',
}

export const space = {
  1: 3.4,
  2: 6.8,
  3: 10.2,
  4: 13.6,
  6: 20.4,
  8: 27.2,
}

export interface Palette {
  bg: string
  surface: string
  text: string
  textMuted: string
  divider: string
  accent: string
  accent2: string
  accentWash: string
  accent100: string
  accent300: string
  accent700: string
  accent800: string
  neutral100: string
  neutral200: string
  neutral800: string
  gain: string
  loss: string
  lossWash: string
  lossBorder: string
}

const light: Palette = {
  bg: '#f2f2f3',
  surface: '#e9e9ea',
  text: '#1d1f20',
  textMuted: 'rgba(29,31,32,0.55)',
  divider: 'rgba(29,31,32,0.16)',
  accent: '#5980a6',
  accent2: '#728fab',
  accentWash: '#eef6ff',
  accent100: '#eef6ff',
  accent300: '#b5d9fd',
  accent700: '#416180',
  accent800: '#2c455d',
  neutral100: '#f5f5f8',
  neutral200: '#e7e7ea',
  neutral800: '#424244',
  gain: '#3f7a63',
  loss: '#9d5f68',
  lossWash: '#fbf1f2',
  lossBorder: '#c79aa1',
}

const dark: Palette = {
  bg: '#15181b',
  surface: '#1c2126',
  text: '#e9ebed',
  textMuted: 'rgba(233,235,237,0.55)',
  divider: 'rgba(233,235,237,0.16)',
  accent: '#94bce3',
  accent2: '#9ebbd8',
  accentWash: 'rgba(148,188,227,0.09)',
  accent100: 'rgba(148,188,227,0.09)',
  accent300: '#b5d9fd',
  accent700: '#b5d9fd',
  accent800: '#d6ebff',
  neutral100: '#2b2b2d',
  neutral200: '#424244',
  neutral800: '#e7e7ea',
  gain: '#5fae8f',
  loss: '#d9a3ab',
  lossWash: 'rgba(157,95,104,0.12)',
  lossBorder: '#a8737d',
}

export const palettes = { light, dark }

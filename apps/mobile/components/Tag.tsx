// File: apps/mobile/components/Tag.tsx
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../lib/ThemeContext'
import { fonts } from '../lib/theme'

type Variant = 'accent' | 'neutral' | 'outline' | 'loss'

export default function Tag({ label, variant = 'neutral' }: { label: string; variant?: Variant }) {
  const { colors } = useTheme()

  const styleFor: Record<Variant, { bg: string; text: string; border?: string }> = {
    accent: { bg: colors.accent100, text: colors.accent800 },
    neutral: { bg: colors.neutral100, text: colors.neutral800 },
    outline: { bg: 'transparent', text: colors.loss, border: colors.lossBorder },
    loss: { bg: colors.lossWash, text: colors.loss },
  }
  const s = styleFor[variant]

  return (
    <View
      style={[
        styles.tag,
        { backgroundColor: s.bg },
        s.border ? { borderWidth: 1, borderColor: s.border } : null,
      ]}
    >
      <Text style={[styles.label, { color: s.text, fontFamily: fonts.body }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3 },
  label: { fontSize: 10.5, letterSpacing: 0.2 },
})

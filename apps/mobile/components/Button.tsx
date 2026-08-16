// File: apps/mobile/components/Button.tsx
import { Pressable, Text, ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from '../lib/ThemeContext'
import { fonts } from '../lib/theme'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: Variant
  disabled?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
  block?: boolean
}

export default function Button({ label, onPress, variant = 'secondary', disabled, loading, style, block }: ButtonProps) {
  const { colors } = useTheme()
  const isDisabled = disabled || loading

  const bg = variant === 'primary' ? colors.accent : 'transparent'
  const borderColor = variant === 'primary' ? colors.accent : variant === 'secondary' ? colors.divider : 'transparent'
  const textColor = variant === 'primary' ? colors.bg : variant === 'ghost' ? colors.accent : colors.text

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor },
        block && { alignSelf: 'stretch' },
        isDisabled && { opacity: 0.45 },
        pressed && !isDisabled && { opacity: 0.75 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor, fontFamily: fonts.heading }]}>{label}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
})

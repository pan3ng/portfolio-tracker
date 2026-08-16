// File: apps/mobile/components/Segmented.tsx
import { View, Pressable, Text, StyleSheet } from 'react-native'
import { useTheme } from '../lib/ThemeContext'
import { fonts } from '../lib/theme'

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  block?: boolean
  size?: 'sm' | 'md'
}

export default function Segmented<T extends string>({ options, value, onChange, block, size = 'sm' }: SegmentedProps<T>) {
  const { colors } = useTheme()
  const minHeight = size === 'sm' ? 32 : 44

  return (
    <View style={[styles.wrap, { borderColor: colors.divider }, block && { alignSelf: 'stretch' }]}>
      {options.map((opt, i) => {
        const active = opt.value === value
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.opt,
              { minHeight, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: colors.divider },
              block && { flex: 1 },
              active && { backgroundColor: colors.accent },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: active ? colors.bg : colors.text, fontFamily: active ? fonts.bodyMedium : fonts.body },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderWidth: 1, alignSelf: 'flex-start', overflow: 'hidden' },
  opt: { paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13 },
})

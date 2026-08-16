// File: apps/mobile/components/BlueprintCard.tsx
import { View, type StyleProp, type ViewStyle } from 'react-native'
import Corner from './Corner'
import { useTheme } from '../lib/ThemeContext'

interface BlueprintCardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  dashed?: boolean
  wash?: boolean
}

/** Hairline-bordered card with corner registration ticks — the "Industry" .card.blueprint look. */
export default function BlueprintCard({ children, style, dashed, wash }: BlueprintCardProps) {
  const { colors } = useTheme()
  const cornerColor = `${colors.text}8c` // ~55% mix, matches CSS color-mix(in srgb, var(--color-text) 55%, transparent)

  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: colors.divider,
          borderStyle: dashed ? 'dashed' : 'solid',
          backgroundColor: wash ? colors.accentWash : 'transparent',
          padding: 14,
          gap: 6,
        },
        style,
      ]}
    >
      <Corner position="tl" color={cornerColor} />
      <Corner position="tr" color={cornerColor} />
      <Corner position="bl" color={cornerColor} />
      <Corner position="br" color={cornerColor} />
      {children}
    </View>
  )
}

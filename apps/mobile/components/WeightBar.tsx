// File: apps/mobile/components/WeightBar.tsx
import { View } from 'react-native'
import { useTheme } from '../lib/ThemeContext'

interface WeightBarProps {
  currentPct: number
  targetPct?: number
  fillColor?: string
  height?: number
}

/** Current-weight fill bar with an optional target tick mark — used on Holdings, Holding detail, and Plan. */
export default function WeightBar({ currentPct, targetPct, fillColor, height = 8 }: WeightBarProps) {
  const { colors } = useTheme()
  const fill = Math.max(0, Math.min(currentPct, 100))

  return (
    <View style={{ position: 'relative', height, backgroundColor: colors.neutral200 }}>
      <View style={{ height, width: `${fill}%`, backgroundColor: fillColor || colors.accent }} />
      {targetPct !== undefined && targetPct > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -2,
            left: `${Math.min(targetPct, 100)}%`,
            width: 2,
            height: height + 4,
            backgroundColor: colors.text,
          }}
        />
      )}
    </View>
  )
}

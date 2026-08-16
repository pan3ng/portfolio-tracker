// File: apps/mobile/components/Corner.tsx
import { View } from 'react-native'

/**
 * One "blueprint" registration-mark corner tick — an L-shaped hairline that
 * sits just outside a card's border. Mirrors .blueprint > .corner from the
 * Industry design system's styles.css (CSS ::before/::after aren't
 * available in RN, so each tick is two thin Views instead of one element).
 */
export default function Corner({ position, color }: { position: 'tl' | 'tr' | 'bl' | 'br'; color: string }) {
  const size = 11
  const offset = -6
  const pos: Record<string, object> = {
    tl: { top: offset, left: offset },
    tr: { top: offset, right: offset },
    bl: { bottom: offset, left: offset },
    br: { bottom: offset, right: offset },
  }
  return (
    <View style={[{ position: 'absolute', width: size, height: size }, pos[position]]} pointerEvents="none">
      <View style={{ position: 'absolute', left: 5, top: 0, width: 1, height: '100%', backgroundColor: color }} />
      <View style={{ position: 'absolute', top: 5, left: 0, width: '100%', height: 1, backgroundColor: color }} />
    </View>
  )
}

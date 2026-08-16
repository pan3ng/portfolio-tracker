// File: apps/mobile/components/TabIcon.tsx
import { View } from 'react-native'

/**
 * Plain-View line icons matching the mockup's stroke SVGs (rect.dashboard,
 * list lines, document, menu). Built without react-native-svg on purpose —
 * adding it would pull in a native module the current EAS dev build
 * doesn't have compiled in, forcing a rebuild just for tab-bar icons.
 */

const SIZE = 20
const STROKE = 1.5

export function OverviewIcon({ color }: { color: string }) {
  const box = (w: number, h: number) => ({ width: w, height: h, borderWidth: STROKE, borderColor: color })
  return (
    <View style={{ width: SIZE, height: SIZE, flexDirection: 'row', justifyContent: 'space-between' }}>
      <View style={{ justifyContent: 'space-between', height: SIZE }}>
        <View style={box(7, 9)} />
        <View style={box(7, 5)} />
      </View>
      <View style={{ justifyContent: 'space-between', height: SIZE }}>
        <View style={box(7, 5)} />
        <View style={box(7, 9)} />
      </View>
    </View>
  )
}

export function HoldingsIcon({ color }: { color: string }) {
  const bar = (w: number) => ({ width: w, height: STROKE, backgroundColor: color })
  return (
    <View style={{ width: SIZE, height: SIZE, justifyContent: 'space-between', paddingVertical: 3 }}>
      <View style={bar(SIZE)} />
      <View style={bar(SIZE)} />
      <View style={bar(SIZE * 0.6)} />
    </View>
  )
}

export function ActivityIcon({ color }: { color: string }) {
  const bar = (w: number) => ({ width: w, height: STROKE, backgroundColor: color })
  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center' }}>
      <View style={{ width: 14, height: 18, borderWidth: STROKE, borderColor: color, alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 4 }}>
        <View style={bar(8)} />
        <View style={bar(8)} />
        <View style={bar(5)} />
      </View>
    </View>
  )
}

export function MoreIcon({ color }: { color: string }) {
  const bar = { width: SIZE, height: STROKE, backgroundColor: color }
  return (
    <View style={{ width: SIZE, height: SIZE, justifyContent: 'center', gap: 8 }}>
      <View style={bar} />
      <View style={bar} />
    </View>
  )
}

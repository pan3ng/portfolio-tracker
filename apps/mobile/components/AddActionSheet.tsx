// File: apps/mobile/components/AddActionSheet.tsx
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '../lib/ThemeContext'
import { fonts } from '../lib/theme'

export default function AddActionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter()
  const { colors } = useTheme()

  const go = (path: string) => {
    onClose()
    router.push(path as any)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.bg, borderTopColor: colors.text }]}>
          <View style={[styles.handle, { backgroundColor: colors.text }]} />
          <Text style={[styles.kicker, { color: colors.textMuted }]}>Record</Text>
          <Pressable style={[styles.row, { borderBottomColor: colors.divider }]} onPress={() => go('/transactions/new')}>
            <Text style={[styles.rowLabel, { color: colors.text, fontFamily: fonts.body }]}>Buy</Text>
            <Text style={[styles.rowArrow, { color: colors.textMuted }]}>→</Text>
          </Pressable>
          <View style={[styles.row, { borderBottomColor: colors.divider, opacity: 0.4 }]}>
            <Text style={[styles.rowLabel, { color: colors.text, fontFamily: fonts.body }]}>Sell</Text>
            <Text style={[styles.rowArrow, { color: colors.textMuted, fontSize: 12 }]}>Coming soon</Text>
          </View>
          <Pressable style={[styles.row, { borderBottomColor: colors.divider }]} onPress={() => go('/transactions/new?kind=deposit')}>
            <Text style={[styles.rowLabel, { color: colors.text, fontFamily: fonts.body }]}>Deposit</Text>
            <Text style={[styles.rowArrow, { color: colors.textMuted }]}>→</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => go('/transactions/new?kind=withdrawal')}>
            <Text style={[styles.rowLabel, { color: colors.text, fontFamily: fonts.body }]}>Withdrawal</Text>
            <Text style={[styles.rowArrow, { color: colors.textMuted }]}>→</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopWidth: 1, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 32 },
  handle: { width: 44, height: 4, opacity: 0.25, alignSelf: 'center', marginBottom: 12 },
  kicker: { fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, borderBottomWidth: 1 },
  rowLabel: { fontSize: 16 },
  rowArrow: { fontSize: 14 },
})

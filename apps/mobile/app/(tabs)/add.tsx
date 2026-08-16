// File: apps/mobile/app/(tabs)/add.tsx
import { Redirect } from 'expo-router'

/**
 * Never actually navigated to — the tab's tabBarButton (see
 * (tabs)/_layout.tsx) intercepts the press and opens AddActionSheet
 * instead. This route only exists because Tabs.Screen requires one.
 */
export default function AddPlaceholder() {
  return <Redirect href="/" />
}

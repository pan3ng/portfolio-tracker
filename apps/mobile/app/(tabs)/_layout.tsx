// File: apps/mobile/app/(tabs)/_layout.tsx
import { useState } from 'react'
import { View, Pressable, Text } from 'react-native'
import { Tabs } from 'expo-router'
import { useTheme } from '../../lib/ThemeContext'
import { OverviewIcon, HoldingsIcon, ActivityIcon, MoreIcon } from '../../components/TabIcon'
import AddActionSheet from '../../components/AddActionSheet'

export default function TabsLayout() {
  const { colors } = useTheme()
  const [showAddSheet, setShowAddSheet] = useState(false)

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: `${colors.text}8c`,
          tabBarStyle: { borderTopColor: colors.divider, backgroundColor: colors.bg, height: 68, paddingBottom: 10, paddingTop: 8 },
          tabBarLabelStyle: { fontSize: 10.5, letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: 'BarlowCondensed_600SemiBold' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Overview', tabBarIcon: ({ color }) => <OverviewIcon color={String(color)} /> }}
        />
        <Tabs.Screen
          name="holdings"
          options={{ title: 'Holdings', tabBarIcon: ({ color }) => <HoldingsIcon color={String(color)} /> }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: '',
            tabBarIcon: () => (
              <View style={{ width: 40, height: 40, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.bg, fontSize: 22, lineHeight: 24 }}>+</Text>
              </View>
            ),
            tabBarButton: (props) => (
              <Pressable
                onPress={() => setShowAddSheet(true)}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              >
                {props.children}
              </Pressable>
            ),
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{ title: 'Activity', tabBarIcon: ({ color }) => <ActivityIcon color={String(color)} /> }}
        />
        <Tabs.Screen
          name="more"
          options={{ title: 'More', tabBarIcon: ({ color }) => <MoreIcon color={String(color)} /> }}
        />
      </Tabs>
      <AddActionSheet visible={showAddSheet} onClose={() => setShowAddSheet(false)} />
    </>
  )
}

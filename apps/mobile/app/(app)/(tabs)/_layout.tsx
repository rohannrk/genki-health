import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProfileSwitcher } from '../../../src/components/ProfileSwitcher';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#059669', // emerald-600
        tabBarInactiveTintColor: '#64748b', // slate-500
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0', // slate-200
          backgroundColor: '#ffffff',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: '#0f172a', // slate-900
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        // Active-profile switcher in the header across all tabs.
        headerTitle: () => <ProfileSwitcher />,
        headerTitleAlign: 'left',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Timeline',
          tabBarLabel: 'Timeline',
          tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={22} color={color} />,
          // Timeline has its own in-page patient selector — no header switcher here.
          headerTitle: () => (
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 18 }}>Timeline</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarLabel: 'Search',
          tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={22} color={color} />,
          headerTitle: () => (
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 18 }}>Search</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color }) => <Ionicons name="chatbubble-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={22} color={color} />,
          // No profile switcher on Settings — show a plain title instead.
          headerTitle: () => (
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 18 }}>Settings</Text>
          ),
        }}
      />
    </Tabs>
  );
}

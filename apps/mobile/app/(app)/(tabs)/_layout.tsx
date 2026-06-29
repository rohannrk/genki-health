import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Calendar, Search, MessageCircle, Settings } from 'lucide-react-native';
import { colors } from '../../../src/theme/genki';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.g8,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.white,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontWeight: '600' },
        headerStyle: {
          backgroundColor: colors.white,
        },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerTitleAlign: 'left',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Timeline',
          tabBarLabel: 'Timeline',
          tabBarIcon: ({ color }) => <Calendar size={22} color={color} />,
          // Timeline has its own in-page patient selector — no header switcher here.
          headerTitle: () => (
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18 }}>Timeline</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarLabel: 'Search',
          tabBarIcon: ({ color }) => <Search size={22} color={color} />,
          headerTitle: () => (
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18 }}>Search</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color }) => <MessageCircle size={22} color={color} />,
          headerTitle: () => (
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18 }}>Ask Genki</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => <Settings size={22} color={color} />,
          // No profile switcher on Settings — show a plain title instead.
          headerTitle: () => (
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18 }}>Settings</Text>
          ),
        }}
      />
    </Tabs>
  );
}

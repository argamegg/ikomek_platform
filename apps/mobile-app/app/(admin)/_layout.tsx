import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ORANGE = '#FF6B00';

export default function AdminLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ORANGE,
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFF',
          borderTopColor: '#F2F2F7',
          paddingBottom: Math.max(insets.bottom, 8),
          height: 60 + Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }
      }}
    >
      <Tabs.Screen name="analytics" options={{
        title: 'Analytics',
        tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />
      }} />
      <Tabs.Screen name="users" options={{
        title: 'Users',
        tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />
      }} />
      <Tabs.Screen name="news-manage" options={{
        title: 'News',
        tabBarIcon: ({ color, size }) => <Ionicons name="newspaper" size={size} color={color} />
      }} />
      <Tabs.Screen name="profile" options={{
        title: 'Profile',
        tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />
      }} />
    </Tabs>
  );
}

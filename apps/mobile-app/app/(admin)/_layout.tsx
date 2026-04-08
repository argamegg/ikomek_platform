import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const ORANGE = '#FF6B00';

export default function AdminLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
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
        title: t('admin.analytics'),
        tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />
      }} />
      <Tabs.Screen name="users" options={{
        title: t('admin.users'),
        tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />
      }} />
      <Tabs.Screen name="news-manage" options={{
        title: t('nav.news'),
        tabBarIcon: ({ color, size }) => <Ionicons name="newspaper" size={size} color={color} />
      }} />
      <Tabs.Screen name="profile" options={{
        title: t('profile.title'),
        tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />
      }} />
    </Tabs>
  );
}

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { apiService } from '../src/utils/api';

const ORANGE = '#FF6B00';

function getRedirectPath(role?: string) {
  switch (role) {
    case 'operator': return '/(operator)/dashboard';
    case 'admin': return '/(admin)/analytics';
    default: return '/(tabs)/';
  }
}

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const seedData = async () => {
      try { await apiService.seedData(); } catch {}
    };
    seedData();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && user) {
        router.replace(getRedirectPath(user.role) as any);
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [isAuthenticated, isLoading, user]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>109</Text>
        </View>
        <Text style={styles.title}>iKomek</Text>
        <Text style={styles.subtitle}>Smart City Service</Text>
      </View>
      <ActivityIndicator size="large" color={ORANGE} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  logoContainer: { alignItems: 'center' },
  logo: { width: 100, height: 100, borderRadius: 25, backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  logoText: { color: '#FFF', fontSize: 36, fontWeight: 'bold' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#1C1C1E' },
  subtitle: { fontSize: 16, color: '#8E8E93', marginTop: 4 },
  loader: { marginTop: 40 }
});

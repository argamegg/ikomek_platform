import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { apiService, Analytics } from '../../src/utils/api';

const ORANGE = '#FF6B00';

const CATEGORY_LABELS: Record<string, string> = {
  electricity: 'Electricity', water: 'Water', heating: 'Heating',
  public_order: 'Public Order', sewage: 'Sewage', waste: 'Waste', roads: 'Roads', other: 'Other'
};
const CATEGORY_COLORS: Record<string, string> = {
  electricity: '#FFB300', water: '#2196F3', heating: '#FF5722',
  public_order: '#4CAF50', sewage: '#607D8B', waste: '#795548', roads: '#9E9E9E'
};

export default function AnalyticsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    try {
      const res = await apiService.getAnalytics();
      setData(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); setIsRefreshing(false); }
  };

  useEffect(() => { fetchAnalytics(); }, []);

  if (isLoading || !data) return <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={ORANGE} /></View>;

  const maxCat = Math.max(...Object.values(data.categories), 1);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); fetchAnalytics(); }} tintColor={ORANGE} />}>
        <Text style={styles.headerTitle} data-testid="admin-analytics-title">{t('admin.analytics')}</Text>
        <Text style={styles.headerSub}>System overview</Text>

        {/* Request Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { borderLeftColor: ORANGE }]}>
            <Text style={[styles.statNum, { color: ORANGE }]}>{data.requests.total}</Text>
            <Text style={styles.statLabel}>Total Requests</Text>
          </View>
          <View style={[styles.statBox, { borderLeftColor: '#FF9500' }]}>
            <Text style={[styles.statNum, { color: '#FF9500' }]}>{data.requests.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statBox, { borderLeftColor: '#007AFF' }]}>
            <Text style={[styles.statNum, { color: '#007AFF' }]}>{data.requests.in_progress}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
          <View style={[styles.statBox, { borderLeftColor: '#34C759' }]}>
            <Text style={[styles.statNum, { color: '#34C759' }]}>{data.requests.closed}</Text>
            <Text style={styles.statLabel}>Closed</Text>
          </View>
        </View>

        {/* Category Breakdown */}
        <Text style={styles.sectionTitle}>By Category</Text>
        <View style={styles.categorySection}>
          {Object.entries(data.categories).map(([key, count]) => (
            <View key={key} style={styles.catRow}>
              <View style={styles.catInfo}>
                <View style={[styles.catDot, { backgroundColor: CATEGORY_COLORS[key] || '#9E9E9E' }]} />
                <Text style={styles.catName}>{CATEGORY_LABELS[key] || key}</Text>
              </View>
              <View style={styles.catBarBg}>
                <View style={[styles.catBar, { width: `${(count / maxCat) * 100}%`, backgroundColor: CATEGORY_COLORS[key] || '#9E9E9E' }]} />
              </View>
              <Text style={styles.catCount}>{count}</Text>
            </View>
          ))}
        </View>

        {/* User Stats */}
        <Text style={styles.sectionTitle}>Users</Text>
        <View style={styles.userStats}>
          <View style={styles.userStat}>
            <Ionicons name="people" size={24} color={ORANGE} />
            <Text style={styles.userStatNum}>{data.users.total}</Text>
            <Text style={styles.userStatLabel}>Total</Text>
          </View>
          <View style={styles.userStat}>
            <Ionicons name="person" size={24} color="#34C759" />
            <Text style={styles.userStatNum}>{data.users.citizens}</Text>
            <Text style={styles.userStatLabel}>Citizens</Text>
          </View>
          <View style={styles.userStat}>
            <Ionicons name="headset" size={24} color="#007AFF" />
            <Text style={styles.userStatNum}>{data.users.operators}</Text>
            <Text style={styles.userStatLabel}>Operators</Text>
          </View>
          <View style={styles.userStat}>
            <Ionicons name="shield" size={24} color="#FF3B30" />
            <Text style={styles.userStatNum}>{data.users.admins}</Text>
            <Text style={styles.userStatLabel}>Admins</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E' },
  headerSub: { fontSize: 15, color: '#8E8E93', marginTop: 4, marginBottom: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statBox: { flex: 1, minWidth: '45%', backgroundColor: '#FFF', borderRadius: 14, padding: 16, borderLeftWidth: 4 },
  statNum: { fontSize: 28, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  categorySection: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 24, gap: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catInfo: { flexDirection: 'row', alignItems: 'center', width: 100, gap: 8 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { fontSize: 13, color: '#1C1C1E', fontWeight: '500' },
  catBarBg: { flex: 1, height: 8, backgroundColor: '#F2F2F7', borderRadius: 4, overflow: 'hidden' },
  catBar: { height: '100%', borderRadius: 4 },
  catCount: { width: 30, fontSize: 13, fontWeight: '600', color: '#1C1C1E', textAlign: 'right' },
  userStats: { flexDirection: 'row', gap: 12 },
  userStat: { flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 16, alignItems: 'center', gap: 6 },
  userStatNum: { fontSize: 22, fontWeight: 'bold', color: '#1C1C1E' },
  userStatLabel: { fontSize: 11, color: '#8E8E93' }
});

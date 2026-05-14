import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { isAxiosError } from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  AdminPlatformStatsResponse,
  apiService,
  OperatorStatsResponse,
  Request,
} from '../utils/api';
import { localizeCategory, localizeProblemType } from '../utils/requestLocalization';

const ORANGE = '#FF6B00';
const BLUE = '#007AFF';
const GREEN = '#34C759';
const AMBER = '#FF9500';

type MonthlyItem = { month: string; count: number };
type RecentItem = {
  id: string;
  title: string;
  address: string;
  category: string;
  status: Request['status'];
  created_at: string;
};

function getInitials(name?: string) {
  return (name || 'IK')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getLastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return { month: getMonthKey(date), count: 0 };
  });
}

function normalizeLocale(language: string) {
  if (language.startsWith('kz') || language.startsWith('kk')) return 'kk';
  if (language.startsWith('en')) return 'en';
  return 'ru';
}

function formatMonth(month: string, language: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  if (Number.isNaN(date.getTime())) return month;
  return new Intl.DateTimeFormat(normalizeLocale(language), { month: 'short' }).format(date);
}

function formatDate(value: string, language: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(normalizeLocale(language), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatMemberSince(value?: string, language = 'ru') {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(normalizeLocale(language), { month: 'long', year: 'numeric' }).format(date);
}

function getAverageClosingDays(requests: Request[]) {
  const durations = requests
    .filter((request) => request.status === 'closed')
    .map((request) => {
      const created = new Date(request.created_at).getTime();
      const closed = new Date(request.closed_at || request.updated_at).getTime();
      return Number.isFinite(created) && Number.isFinite(closed) ? Math.max(closed - created, 0) : null;
    })
    .filter((value): value is number => value !== null);

  if (!durations.length) return 0;
  return Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length / 86400000) * 10) / 10;
}

function buildMonthlyFromRequests(requests: Request[]) {
  const months = getLastSixMonths();
  requests.forEach((request) => {
    const date = new Date(request.created_at);
    if (Number.isNaN(date.getTime())) return;
    const item = months.find((month) => month.month === getMonthKey(date));
    if (item) item.count += 1;
  });
  return months;
}

function getStatusColor(status: Request['status']) {
  if (status === 'closed') return GREEN;
  if (status === 'in_progress') return BLUE;
  return AMBER;
}

export function ProfileCabinetScreen() {
  const { t, i18n } = useTranslation();
  const { user, token, isLoading: isAuthLoading, isAdmin, isOperator } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [citizenRequests, setCitizenRequests] = useState<Request[]>([]);
  const [operatorStats, setOperatorStats] = useState<OperatorStatsResponse | null>(null);
  const [adminStats, setAdminStats] = useState<AdminPlatformStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    if (!token || !user) {
      setCitizenRequests([]);
      setOperatorStats(null);
      setAdminStats(null);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const endpoint = isAdmin
      ? '/admin/platform-stats'
      : isOperator
        ? '/operator/my-stats'
        : '/requests';

    try {
      if (isAdmin) {
        const response = await apiService.getAdminPlatformStats();
        setAdminStats(response.data);
      } else if (isOperator) {
        const response = await apiService.getOperatorMyStats();
        setOperatorStats(response.data);
      } else {
        const response = await apiService.getUserRequests();
        setCitizenRequests(response.data);
      }
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      console.log('Profile stats unavailable:', {
        endpoint,
        status,
        role: user.role,
        hasToken: Boolean(token),
      });

      if (isAdmin) {
        setAdminStats(null);
      } else if (isOperator) {
        setOperatorStats(null);
      } else {
        setCitizenRequests([]);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAdmin, isAuthLoading, isOperator, token, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    void loadData();
  };

  const roleLabel = isAdmin ? t('roles.admin') : isOperator ? t('roles.operator') : t('roles.citizen');
  const roleColor = isAdmin ? '#FF3B30' : isOperator ? BLUE : ORANGE;

  const stats = useMemo(() => {
    if (isAdmin && adminStats) {
      return [
        { label: t('admin.totalRequests'), value: adminStats.total_requests, color: ORANGE, icon: 'document-text-outline' as const },
        { label: t('admin.citizens'), value: adminStats.total_users, color: BLUE, icon: 'people-outline' as const },
        { label: t('admin.operators'), value: adminStats.total_operators, color: AMBER, icon: 'construct-outline' as const },
        { label: t('status.closed'), value: adminStats.closed, color: GREEN, icon: 'checkmark-circle-outline' as const },
      ];
    }

    if (isOperator && operatorStats) {
      return [
        { label: t('profile.operatorAssigned'), value: operatorStats.total_assigned, color: ORANGE, icon: 'briefcase-outline' as const },
        { label: t('status.closed'), value: operatorStats.closed, color: GREEN, icon: 'checkmark-circle-outline' as const },
        { label: t('profile.operatorInProgress'), value: operatorStats.in_progress, color: BLUE, icon: 'sync-outline' as const },
        { label: t('profile.operatorQueue'), value: operatorStats.pending_queue, color: AMBER, icon: 'time-outline' as const },
      ];
    }

    return [
      { label: t('profile.totalRequests'), value: citizenRequests.length, color: ORANGE, icon: 'document-text-outline' as const },
      { label: t('status.closed'), value: citizenRequests.filter((request) => request.status === 'closed').length, color: GREEN, icon: 'checkmark-circle-outline' as const },
      { label: t('status.inProgress'), value: citizenRequests.filter((request) => request.status === 'in_progress').length, color: BLUE, icon: 'sync-outline' as const },
      { label: t('status.pending'), value: citizenRequests.filter((request) => request.status === 'pending').length, color: AMBER, icon: 'time-outline' as const },
    ];
  }, [adminStats, citizenRequests, isAdmin, isOperator, operatorStats, t]);

  const averageDays = isOperator ? operatorStats?.avg_close_days ?? 0 : getAverageClosingDays(citizenRequests);
  const monthlyActivity: MonthlyItem[] = isAdmin
    ? adminStats?.monthly_activity ?? getLastSixMonths()
    : isOperator
      ? operatorStats?.monthly_activity ?? getLastSixMonths()
      : buildMonthlyFromRequests(citizenRequests);
  const maxMonthCount = Math.max(...monthlyActivity.map((item) => item.count), 1);

  const recentRequests: RecentItem[] = isOperator
    ? (operatorStats?.recent_requests ?? []).map((request) => ({
        id: request.id,
        title: request.category_name || t('request.details'),
        address: request.address,
        category: request.category_name || '—',
        status: request.status,
        created_at: request.created_at,
      }))
    : citizenRequests
        .slice()
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5)
        .map((request) => ({
          id: request.id,
          title: localizeProblemType(request.category_id, request.problem_type, t),
          address: request.address,
          category: localizeCategory(request.category_id || request.category_name, t),
          status: request.status,
          created_at: request.created_at,
        }));

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('profile.title')}</Text>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={22} color="#1C1C1E" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user?.full_name)}</Text>
          </View>
          <Text style={styles.profileName}>{user?.full_name}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: `${roleColor}18` }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
          </View>
          <Text style={styles.memberSince}>
            {t('profile.memberSince')} {formatMemberSince(user?.created_at, i18n.language)}
          </Text>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((item) => (
            <View key={item.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: `${item.color}16` }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={styles.statLabel}>{item.label}</Text>
              <Text style={styles.statValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {!isAdmin && (
          <View style={styles.averageCard}>
            <Ionicons name="timer-outline" size={18} color={ORANGE} />
            <Text style={styles.averageText}>
              {t('profile.avgCloseDays')}: <Text style={styles.averageValue}>{averageDays}</Text> {t('profile.days')}
            </Text>
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('profile.activityTitle')}</Text>
          <View style={styles.chartRows}>
            {monthlyActivity.map((item) => (
              <View key={item.month} style={styles.chartRow}>
                <Text style={styles.chartMonth}>{formatMonth(item.month, i18n.language)}</Text>
                <View style={styles.chartTrack}>
                  <View style={[styles.chartBar, { width: `${Math.max((item.count / maxMonthCount) * 100, item.count ? 8 : 0)}%` }]} />
                </View>
                <Text style={styles.chartValue}>{item.count}</Text>
              </View>
            ))}
          </View>
        </View>

        {isAdmin ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t('profile.adminCategories')}</Text>
            {(adminStats?.top_categories ?? []).length === 0 ? (
              <Text style={styles.emptyText}>{t('common.empty')}</Text>
            ) : (
              (adminStats?.top_categories ?? []).map((category) => {
                const max = Math.max(...(adminStats?.top_categories ?? []).map((item) => item.count), 1);
                return (
                  <View key={category.id || category.name} style={styles.categoryRow}>
                    <View style={styles.categoryHeader}>
                      <Text style={styles.categoryName}>{localizeCategory(category.id || category.name, t)}</Text>
                      <Text style={styles.categoryCount}>{category.count}</Text>
                    </View>
                    <View style={styles.categoryTrack}>
                      <View style={[styles.categoryBar, { width: `${Math.max((category.count / max) * 100, 4)}%` }]} />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t('profile.recentRequests')}</Text>
            {recentRequests.length === 0 ? (
              <Text style={styles.emptyText}>{t('myRequests.noRequests')}</Text>
            ) : (
              recentRequests.map((request) => (
                <TouchableOpacity
                  key={request.id}
                  style={styles.requestCard}
                  onPress={() => router.push(isOperator ? '/(operator)/dashboard' : '/(tabs)/requests')}
                >
                  <View style={styles.requestTopRow}>
                    <Text style={styles.requestTitle} numberOfLines={1}>{request.title}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(request.status)}18` }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                        {request.status === 'closed' ? t('status.closed') : request.status === 'in_progress' ? t('status.inProgress') : t('status.pending')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.requestMeta}>📍 {request.address}</Text>
                  <Text style={styles.requestMeta}>🕐 {formatDate(request.created_at, i18n.language)}</Text>
                  <Text style={styles.requestMeta}>💬 {t('admin.category')}: {request.category}</Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity style={styles.allRequestsButton} onPress={() => router.push(isOperator ? '/(operator)/dashboard' : '/(tabs)/requests')}>
              <Text style={styles.allRequestsText}>{t('profile.allRequests')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const shadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1C1C1E' },
  settingsButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', ...shadow },
  profileCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, alignItems: 'center', ...shadow },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#FFF', fontSize: 26, fontWeight: '800' },
  profileName: { fontSize: 22, fontWeight: '800', color: '#1C1C1E', textAlign: 'center' },
  profileEmail: { fontSize: 14, color: '#64748B', marginTop: 4 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginTop: 12 },
  roleText: { fontSize: 12, fontWeight: '800' },
  memberSince: { marginTop: 10, color: '#64748B', fontSize: 14, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '48%', minHeight: 132, backgroundColor: '#FFF', borderRadius: 16, padding: 16, justifyContent: 'space-between', ...shadow },
  statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statLabel: { color: '#64748B', fontSize: 13, fontWeight: '700' },
  statValue: { color: '#0F172A', fontSize: 30, fontWeight: '900' },
  averageCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10, ...shadow },
  averageText: { color: '#475569', fontWeight: '700', flex: 1 },
  averageValue: { color: '#0F172A', fontWeight: '900' },
  sectionCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, ...shadow },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 14 },
  chartRows: { gap: 10 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chartMonth: { width: 42, color: '#64748B', fontSize: 12, fontWeight: '700' },
  chartTrack: { flex: 1, height: 10, borderRadius: 999, backgroundColor: '#FFE3D3', overflow: 'hidden' },
  chartBar: { height: '100%', borderRadius: 999, backgroundColor: ORANGE },
  chartValue: { width: 24, textAlign: 'right', color: '#0F172A', fontWeight: '800' },
  requestCard: { borderRadius: 14, padding: 14, backgroundColor: '#F8FAFC', marginBottom: 10 },
  requestTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  requestTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#0F172A' },
  requestMeta: { marginTop: 6, color: '#64748B', fontSize: 13, fontWeight: '600' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  allRequestsButton: { marginTop: 4, padding: 13, borderRadius: 12, backgroundColor: '#FFF3EC', alignItems: 'center' },
  allRequestsText: { color: ORANGE, fontWeight: '800' },
  emptyText: { color: '#94A3B8', fontWeight: '700', textAlign: 'center', paddingVertical: 16 },
  categoryRow: { marginBottom: 14 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  categoryName: { color: '#0F172A', fontWeight: '800' },
  categoryCount: { color: '#64748B', fontWeight: '800' },
  categoryTrack: { height: 9, borderRadius: 999, backgroundColor: '#FFE3D3', overflow: 'hidden' },
  categoryBar: { height: '100%', borderRadius: 999, backgroundColor: ORANGE },
});

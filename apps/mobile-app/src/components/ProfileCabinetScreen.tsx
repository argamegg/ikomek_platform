import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { isAxiosError } from 'axios';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  AdminPlatformStatsResponse,
  apiService,
  getApiErrorMessage,
  OperatorStatsResponse,
  Request,
} from '../utils/api';
import { localizeCategory, localizeProblemType } from '../utils/requestLocalization';

const ORANGE = '#FF6B00';
const BLUE = '#007AFF';
const GREEN = '#34C759';
const AMBER = '#FF9500';
const PROFILE_NAME_CHAR_PATTERN = /^[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]$/;
const PROFILE_NAME_PATTERN = /^[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]+$/;
const KZ_PHONE_PATTERN = /^7\d{10}$/;
const MIN_BIRTH_DATE = '1900-01-01';

type MonthlyItem = { month: string; count: number };
type RecentItem = {
  id: string;
  title: string;
  address: string;
  category: string;
  status: Request['status'];
  created_at: string;
  updated_at: string;
};
type ProfileEditForm = {
  firstName: string;
  lastName: string;
  phone: string;
  gender: string;
  birthDate: string;
  avatarUrl: string;
};
type ProfileFormErrors = Partial<Record<'firstName' | 'lastName' | 'phone' | 'birthDate', string>>;

const GENDER_OPTIONS = ['male', 'female'] as const;

function getInitials(name?: string) {
  return (name || 'IK')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function splitName(name?: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

function sanitizeProfileName(value: string) {
  return Array.from(value).filter((char) => PROFILE_NAME_CHAR_PATTERN.test(char)).join('');
}

function normalizeKzPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '');
  const normalized = digits.length === 11 && digits.startsWith('8') ? `7${digits.slice(1)}` : digits;
  return normalized.slice(0, 11);
}

function formatBirthDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function isValidBirthDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < MIN_BIRTH_DATE) return false;

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const [year, month, day] = value.split('-').map(Number);
  const isCalendarDate =
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day;

  if (!isCalendarDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today;
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

function getActivityTime(createdAt?: string, updatedAt?: string) {
  const updated = updatedAt ? new Date(updatedAt).getTime() : NaN;
  if (Number.isFinite(updated)) return updated;

  const created = createdAt ? new Date(createdAt).getTime() : NaN;
  return Number.isFinite(created) ? created : 0;
}

export function ProfileCabinetScreen() {
  const { t, i18n } = useTranslation();
  const { user, token, isLoading: isAuthLoading, isAdmin, isOperator, updateProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [citizenRequests, setCitizenRequests] = useState<Request[]>([]);
  const [operatorStats, setOperatorStats] = useState<OperatorStatsResponse | null>(null);
  const [adminStats, setAdminStats] = useState<AdminPlatformStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState<ProfileFormErrors>({});
  const [profileForm, setProfileForm] = useState<ProfileEditForm>({
    firstName: '',
    lastName: '',
    phone: '',
    gender: '',
    birthDate: '',
    avatarUrl: '',
  });

  const isCitizen = Boolean(user) && (user?.role === 'citizen' || (!isAdmin && !isOperator && !user?.role));

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

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    void loadData();
  };

  const openProfileEditor = () => {
    const name = splitName(user?.full_name);
    setProfileForm({
      firstName: sanitizeProfileName(name.firstName),
      lastName: sanitizeProfileName(name.lastName),
      phone: normalizeKzPhoneInput(user?.phone || ''),
      gender: user?.gender || '',
      birthDate: formatBirthDateInput(user?.birth_date || ''),
      avatarUrl: user?.avatar_url || '',
    });
    setProfileErrors({});
    setIsProfileEditorOpen(true);
  };

  const updateProfileForm = <K extends keyof ProfileEditForm>(key: K, value: ProfileEditForm[K]) => {
    const nextValue = (
      key === 'firstName' || key === 'lastName'
        ? sanitizeProfileName(value)
        : key === 'phone'
          ? normalizeKzPhoneInput(value)
          : key === 'birthDate'
            ? formatBirthDateInput(value)
            : value
    ) as ProfileEditForm[K];

    if (key === 'firstName' || key === 'lastName' || key === 'phone' || key === 'birthDate') {
      setProfileErrors((current) => {
        const next = { ...current };
        delete next[key as keyof ProfileFormErrors];
        return next;
      });
    }

    setProfileForm((current) => ({ ...current, [key]: nextValue }));
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('profile.photoPermissionTitle'), t('profile.photoPermissionMessage'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
      base64: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      updateProfileForm('avatarUrl', `data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const saveProfile = async () => {
    const firstName = profileForm.firstName.trim();
    const lastName = profileForm.lastName.trim();
    const phone = normalizeKzPhoneInput(profileForm.phone);
    const birthDate = profileForm.birthDate.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const nextErrors: ProfileFormErrors = {};

    if (!firstName) {
      nextErrors.firstName = t('profile.nameRequired');
    } else if (!PROFILE_NAME_PATTERN.test(firstName)) {
      nextErrors.firstName = t('profile.nameLettersOnly');
    }

    if (!lastName) {
      nextErrors.lastName = t('profile.nameRequired');
    } else if (!PROFILE_NAME_PATTERN.test(lastName)) {
      nextErrors.lastName = t('profile.nameLettersOnly');
    }

    if (phone && !KZ_PHONE_PATTERN.test(phone)) {
      nextErrors.phone = t('profile.phoneInvalid');
    }

    if (!isValidBirthDate(birthDate)) {
      nextErrors.birthDate = t('profile.birthDateInvalid');
    }

    if (Object.keys(nextErrors).length) {
      setProfileErrors(nextErrors);
      Alert.alert(t('common.error'), Object.values(nextErrors)[0] || t('profile.profileSaveError'));
      return;
    }

    setProfileErrors({});
    setIsSavingProfile(true);
    try {
      await updateProfile({
        fullName,
        phone,
        displayName: fullName,
        gender: profileForm.gender || undefined,
        birthDate,
        avatarUrl: profileForm.avatarUrl,
      });
      setIsProfileEditorOpen(false);
      Alert.alert(t('common.success'), t('profile.profileSaved'));
    } catch (error) {
      Alert.alert(t('common.error'), getApiErrorMessage(error, t('profile.profileSaveError')));
    } finally {
      setIsSavingProfile(false);
    }
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
    ? (operatorStats?.recent_requests ?? [])
        .slice()
        .sort((a, b) => getActivityTime(b.created_at, b.updated_at) - getActivityTime(a.created_at, a.updated_at))
        .map((request) => ({
          id: request.id,
          title: request.category_name || t('request.details'),
          address: request.address,
          category: request.category_name || '—',
          status: request.status,
          created_at: request.created_at,
          updated_at: request.updated_at,
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
          updated_at: request.updated_at,
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
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{getInitials(user?.full_name)}</Text>
            )}
          </View>
          <Text style={styles.profileName}>{user?.full_name}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          {user?.phone ? <Text style={styles.profileSecondary}>{user.phone}</Text> : null}
          {user?.birth_date ? <Text style={styles.profileSecondary}>{user.birth_date}</Text> : null}
          <View style={[styles.roleBadge, { backgroundColor: `${roleColor}18` }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
          </View>
          <Text style={styles.memberSince}>
            {t('profile.memberSince')} {formatMemberSince(user?.created_at, i18n.language)}
          </Text>
          {isCitizen ? (
            <TouchableOpacity style={styles.profileEditButton} onPress={openProfileEditor}>
              <Ionicons name="create-outline" size={18} color={ORANGE} />
              <Text style={styles.profileEditButtonText}>{t('profile.editProfile')}</Text>
            </TouchableOpacity>
          ) : null}
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
                  <Text style={styles.requestMeta}>🕐 {formatDate(request.updated_at || request.created_at, i18n.language)}</Text>
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

      <Modal
        visible={isProfileEditorOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsProfileEditorOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.editorBackdrop}
        >
          <TouchableOpacity
            style={styles.editorBackdropPressable}
            activeOpacity={1}
            onPress={() => setIsProfileEditorOpen(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.editorSheet}>
              <View style={styles.editorHandle} />
              <View style={styles.editorHeader}>
                <View>
                  <Text style={styles.editorEyebrow}>{t('profile.title')}</Text>
                  <Text style={styles.editorTitle}>{t('profile.editTitle')}</Text>
                </View>
                <TouchableOpacity style={styles.editorCloseButton} onPress={() => setIsProfileEditorOpen(false)}>
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.editorContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
              >
                <View style={styles.editorAvatarBlock}>
                  <View style={styles.editorAvatar}>
                    {profileForm.avatarUrl ? (
                      <Image source={{ uri: profileForm.avatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.editorAvatarText}>{getInitials(`${profileForm.firstName} ${profileForm.lastName}`)}</Text>
                    )}
                  </View>
                  <View style={styles.editorAvatarActions}>
                    <TouchableOpacity style={styles.editorGhostButton} onPress={pickAvatar}>
                      <Ionicons name="image-outline" size={17} color={ORANGE} />
                      <Text style={styles.editorGhostButtonText}>{t('profile.changePhoto')}</Text>
                    </TouchableOpacity>
                    {profileForm.avatarUrl ? (
                      <TouchableOpacity style={styles.editorGhostButton} onPress={() => updateProfileForm('avatarUrl', '')}>
                        <Ionicons name="trash-outline" size={17} color="#EF4444" />
                        <Text style={[styles.editorGhostButtonText, { color: '#EF4444' }]}>{t('profile.removePhoto')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                <View style={styles.editorGrid}>
                  <View style={styles.editorField}>
                    <Text style={styles.editorLabel}>{t('profile.firstName')}</Text>
                    <TextInput
                      value={profileForm.firstName}
                      onChangeText={(value) => updateProfileForm('firstName', value)}
                      style={[styles.editorInput, profileErrors.firstName && styles.editorInputError]}
                      placeholder={t('profile.firstName')}
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="words"
                      maxLength={40}
                    />
                    {profileErrors.firstName ? <Text style={styles.editorError}>{profileErrors.firstName}</Text> : null}
                  </View>
                  <View style={styles.editorField}>
                    <Text style={styles.editorLabel}>{t('profile.lastName')}</Text>
                    <TextInput
                      value={profileForm.lastName}
                      onChangeText={(value) => updateProfileForm('lastName', value)}
                      style={[styles.editorInput, profileErrors.lastName && styles.editorInputError]}
                      placeholder={t('profile.lastName')}
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="words"
                      maxLength={40}
                    />
                    {profileErrors.lastName ? <Text style={styles.editorError}>{profileErrors.lastName}</Text> : null}
                  </View>
                </View>

                <View style={styles.editorField}>
                  <Text style={styles.editorLabel}>{t('profile.phone')}</Text>
                  <TextInput
                    value={profileForm.phone}
                    onChangeText={(value) => updateProfileForm('phone', value)}
                    style={[styles.editorInput, profileErrors.phone && styles.editorInputError]}
                    placeholder="77001234567"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    textContentType="telephoneNumber"
                    maxLength={11}
                  />
                  {profileErrors.phone ? <Text style={styles.editorError}>{profileErrors.phone}</Text> : null}
                </View>

                <View style={styles.editorField}>
                  <Text style={styles.editorLabel}>{t('profile.gender')}</Text>
                  <View style={styles.genderRow}>
                    {GENDER_OPTIONS.map((gender) => (
                      <TouchableOpacity
                        key={gender}
                        style={[
                          styles.genderChip,
                          profileForm.gender === gender && styles.genderChipActive,
                        ]}
                        onPress={() => updateProfileForm('gender', profileForm.gender === gender ? '' : gender)}
                      >
                        <Text
                          style={[
                            styles.genderChipText,
                            profileForm.gender === gender && styles.genderChipTextActive,
                          ]}
                        >
                          {t(`profile.genders.${gender}`)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.editorField}>
                  <Text style={styles.editorLabel}>{t('profile.birthDate')}</Text>
                  <TextInput
                    value={profileForm.birthDate}
                    onChangeText={(value) => updateProfileForm('birthDate', value)}
                    style={[styles.editorInput, profileErrors.birthDate && styles.editorInputError]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'number-pad'}
                    maxLength={10}
                  />
                  {profileErrors.birthDate ? <Text style={styles.editorError}>{profileErrors.birthDate}</Text> : null}
                </View>
              </ScrollView>

              <View style={styles.editorActions}>
                <TouchableOpacity
                  style={styles.editorCancelButton}
                  onPress={() => setIsProfileEditorOpen(false)}
                  disabled={isSavingProfile}
                >
                  <Text style={styles.editorCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editorSaveButton, isSavingProfile && styles.editorSaveButtonDisabled]}
                  onPress={() => void saveProfile()}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.editorSaveText}>{t('common.save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
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
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarText: { color: '#FFF', fontSize: 26, fontWeight: '800' },
  profileName: { fontSize: 22, fontWeight: '800', color: '#1C1C1E', textAlign: 'center' },
  profileEmail: { fontSize: 14, color: '#64748B', marginTop: 4 },
  profileSecondary: { color: '#94A3B8', fontSize: 13, fontWeight: '700', marginTop: 3 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginTop: 12 },
  roleText: { fontSize: 12, fontWeight: '800' },
  memberSince: { marginTop: 10, color: '#64748B', fontSize: 14, fontWeight: '600' },
  profileEditButton: { marginTop: 16, minHeight: 46, alignSelf: 'stretch', borderRadius: 14, backgroundColor: '#FFF3EC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  profileEditButtonText: { color: ORANGE, fontWeight: '800', fontSize: 15 },
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
  editorBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.46)' },
  editorBackdropPressable: { flex: 1, justifyContent: 'flex-end' },
  editorSheet: { maxHeight: '92%', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FFF' },
  editorHandle: { alignSelf: 'center', width: 48, height: 5, borderRadius: 999, backgroundColor: '#E5E7EB', marginBottom: 16 },
  editorHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 },
  editorEyebrow: { color: ORANGE, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  editorTitle: { color: '#0F172A', fontSize: 24, fontWeight: '900', marginTop: 4 },
  editorCloseButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  editorContent: { gap: 14, paddingBottom: 12 },
  editorAvatarBlock: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: '#F8FAFC' },
  editorAvatar: { width: 78, height: 78, borderRadius: 39, backgroundColor: ORANGE, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  editorAvatarText: { color: '#FFF', fontSize: 26, fontWeight: '900' },
  editorAvatarActions: { flex: 1, gap: 8 },
  editorGhostButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: '#E5E7EB' },
  editorGhostButtonText: { color: ORANGE, fontSize: 13, fontWeight: '800' },
  editorGrid: { flexDirection: 'row', gap: 10 },
  editorField: { flex: 1, gap: 8 },
  editorLabel: { color: '#0F172A', fontSize: 13, fontWeight: '800' },
  editorInput: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF', paddingHorizontal: 14, color: '#0F172A', fontSize: 15, fontWeight: '700' },
  editorInputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  editorError: { color: '#DC2626', fontSize: 12, fontWeight: '800' },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderChip: { flex: 1, minHeight: 46, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  genderChipActive: { borderColor: ORANGE, backgroundColor: '#FFF3EC' },
  genderChipText: { color: '#64748B', fontSize: 14, fontWeight: '800' },
  genderChipTextActive: { color: ORANGE },
  editorActions: { flexDirection: 'row', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  editorCancelButton: { flex: 1, minHeight: 50, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  editorCancelText: { color: '#475569', fontWeight: '900', fontSize: 15 },
  editorSaveButton: { flex: 1, minHeight: 50, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  editorSaveButtonDisabled: { opacity: 0.68 },
  editorSaveText: { color: '#FFF', fontWeight: '900', fontSize: 15 },
});

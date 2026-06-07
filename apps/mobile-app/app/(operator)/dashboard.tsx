import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity,
  ActivityIndicator, Image, Modal, PanResponder, Pressable, ScrollView, TextInput, Alert, useWindowDimensions,
  KeyboardAvoidingView, Keyboard, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { apiService, type Category, type Request, type Message, type RequestPriority } from '../../src/utils/api';
import { StatusBadge } from '../../src/components/StatusBadge';
import {
  getStatusTranslationKey,
  localizeCategory,
  localizeProblemType,
  localizeRequestDescription,
} from '../../src/utils/requestLocalization';
import { localizeRequestPriority } from '../../src/utils/requestMeta';

const ORANGE = '#FF6B00';
const STATUSES: Request['status'][] = ['pending', 'in_progress', 'closed'];
const PRIORITIES: RequestPriority[] = ['unset', 'low', 'medium', 'high'];
const PRIORITY_META: Record<RequestPriority, { background: string; text: string; border: string; strip: string }> = {
  unset: { background: '#F8FAFC', text: '#64748B', border: '#CBD5E1', strip: '#94A3B8' },
  low: { background: '#F3F4F6', text: '#6B7280', border: '#D1D5DB', strip: '#6B7280' },
  medium: { background: '#FEF9C3', text: '#CA8A04', border: '#FDE047', strip: '#CA8A04' },
  high: { background: '#FEE2E2', text: '#DC2626', border: '#FCA5A5', strip: '#DC2626' },
};
const PRIORITY_WEIGHT: Record<RequestPriority, number> = { high: 3, medium: 2, low: 1, unset: 0 };
const STATS_HORIZONTAL_PADDING = 16;
const STATS_GAP = 8;

type PriorityFilter = RequestPriority | null;
type SortMode = 'newest' | 'oldest' | 'priority';
type ChatAttachment = {
  uri: string;
  dataUrl: string;
  label: string;
  type: 'image';
};

function mergeMessages(current: Message[], incoming: Message) {
  if (current.some((message) => message.id === incoming.id)) {
    return current;
  }

  return [...current, incoming].sort(
    (first, second) => new Date(first.created_at).getTime() - new Date(second.created_at).getTime(),
  );
}

function getRequestActivityTime(request: Request) {
  const updated = new Date(request.updated_at || '').getTime();
  if (Number.isFinite(updated)) return updated;

  const created = new Date(request.created_at).getTime();
  return Number.isFinite(created) ? created : 0;
}

function getSearchText(request: Request) {
  return [
    request.problem_type,
    request.address,
    request.category_id,
    request.category_name,
    request.reason,
    request.description,
  ].filter(Boolean).join(' ').toLowerCase();
}

function getPriorityValue(priority?: Request['priority']): RequestPriority {
  return priority ?? 'unset';
}

type OperatorFilterSheetProps = {
  visible: boolean;
  categories: Category[];
  selectedCategory: string | null;
  selectedPriority: PriorityFilter;
  selectedSort: SortMode;
  onClose: () => void;
  onReset: () => void;
  onApply: (value: { category: string | null; priority: PriorityFilter; sort: SortMode }) => void;
};

function OperatorFilterSheet({
  visible,
  categories,
  selectedCategory,
  selectedPriority,
  selectedSort,
  onClose,
  onReset,
  onApply,
}: OperatorFilterSheetProps) {
  const { t } = useTranslation();
  const [draftCategory, setDraftCategory] = useState<string | null>(selectedCategory);
  const [draftPriority, setDraftPriority] = useState<PriorityFilter>(selectedPriority);
  const [draftSort, setDraftSort] = useState<SortMode>(selectedSort);
  const translateY = React.useRef(new Animated.Value(420)).current;

  useEffect(() => {
    if (!visible) return;

    setDraftCategory(selectedCategory);
    setDraftPriority(selectedPriority);
    setDraftSort(selectedSort);
    translateY.setValue(420);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 90,
      friction: 13,
    }).start();
  }, [selectedCategory, selectedPriority, selectedSort, translateY, visible]);

  const closeAnimated = useCallback(() => {
    Animated.timing(translateY, {
      toValue: 420,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      translateY.setValue(420);
      onClose();
    });
  }, [onClose, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          translateY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 120 || gesture.vy > 1.1) {
            closeAnimated();
            return;
          }

          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        },
      }),
    [closeAnimated, translateY],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeAnimated}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={closeAnimated} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('operator.filtersTitle')}</Text>
            <TouchableOpacity
              onPress={() => {
                setDraftCategory(null);
                setDraftPriority(null);
                setDraftSort('newest');
                onReset();
              }}
            >
              <Text style={styles.sheetReset}>{t('operator.resetFilters')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>{t('operator.filterByCategory')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetPillRow}>
                <TouchableOpacity
                  style={[styles.sheetPill, !draftCategory && styles.sheetPillActive]}
                  onPress={() => setDraftCategory(null)}
                >
                  <Text style={[styles.sheetPillText, !draftCategory && styles.sheetPillTextActive]}>{t('operator.allCategories')}</Text>
                </TouchableOpacity>
                {categories.map((category) => {
                  const active = draftCategory === category.id;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[styles.sheetPill, active && styles.sheetPillActive]}
                      onPress={() => setDraftCategory(category.id)}
                    >
                      <Text style={[styles.sheetPillText, active && styles.sheetPillTextActive]}>
                        {localizeCategory(category.id, t)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.sheetSeparator} />

            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>{t('operator.filterByPriority')}</Text>
              <View style={styles.sheetGrid}>
                <TouchableOpacity
                  style={[styles.sheetGridButton, !draftPriority && styles.sheetGridButtonActive]}
                  onPress={() => setDraftPriority(null)}
                >
                  <Text style={[styles.sheetGridText, !draftPriority && styles.sheetGridTextActive]}>{t('operator.allPriorities')}</Text>
                </TouchableOpacity>
                {PRIORITIES.map((priority) => {
                  const active = draftPriority === priority;
                  return (
                    <TouchableOpacity
                      key={priority}
                      style={[
                        styles.sheetGridButton,
                        active && styles.sheetGridButtonActive,
                        active && { backgroundColor: PRIORITY_META[priority].background, borderColor: PRIORITY_META[priority].border },
                      ]}
                      onPress={() => setDraftPriority(priority)}
                    >
                      <Text style={[styles.sheetGridText, active && { color: PRIORITY_META[priority].text }]}>
                        {localizeRequestPriority(priority, t)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.sheetSeparator} />

            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>{t('operator.sortLabel')}</Text>
              <View style={styles.sheetSortRow}>
                {([
                  { key: 'newest', label: t('operator.sortNewest'), icon: 'arrow-down-outline' },
                  { key: 'oldest', label: t('operator.sortOldest'), icon: 'arrow-up-outline' },
                  { key: 'priority', label: t('operator.sortPriority'), icon: 'flag-outline' },
                ] as { key: SortMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[]).map((item) => {
                  const active = draftSort === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.sheetSortButton, active && styles.sheetSortButtonActive]}
                      onPress={() => setDraftSort(item.key)}
                    >
                      <Ionicons name={item.icon} size={17} color={active ? '#FFF' : '#475569'} />
                      <Text style={[styles.sheetSortText, active && styles.sheetSortTextActive]}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.sheetApplyButton}
            onPress={() => {
              onApply({ category: draftCategory, priority: draftPriority, sort: draftSort });
              closeAnimated();
            }}
          >
            <Text style={styles.sheetApplyText}>{t('operator.applyFilters')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function OperatorDashboard() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Request['status'] | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(null);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [selected, setSelected] = useState<Request | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatAttachment, setChatAttachment] = useState<ChatAttachment | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [statusDraft, setStatusDraft] = useState<Request['status']>('in_progress');
  const [priorityDraft, setPriorityDraft] = useState<RequestPriority>('unset');
  const [assignedDepartment, setAssignedDepartment] = useState('');
  const [operatorNotes, setOperatorNotes] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const chatSocketRef = useRef<WebSocket | null>(null);
  const keyboardLift = Platform.OS === 'ios' ? keyboardHeight : 0;

  const fetchRequests = useCallback(async () => {
    try {
      const res = await apiService.getOperatorRequests();
      setAllRequests(
        res.data
          .slice()
          .sort((first, second) => getRequestActivityTime(second) - getRequestActivityTime(first)),
      );
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); setIsRefreshing(false); }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiService.getCategories();
      setCategories(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchCategories();
  }, [fetchCategories, fetchRequests]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return allRequests
      .filter((request) => {
        const matchesStatus = !statusFilter || request.status === statusFilter;
        const matchesCategory = !categoryFilter || request.category_id === categoryFilter;
        const matchesPriority = !priorityFilter || getPriorityValue(request.priority) === priorityFilter;
        const matchesSearch = !query || getSearchText(request).includes(query);
        return matchesStatus && matchesCategory && matchesPriority && matchesSearch;
      })
      .sort((first, second) => {
        if (sortMode === 'priority') {
          const priorityDiff = PRIORITY_WEIGHT[getPriorityValue(second.priority)] - PRIORITY_WEIGHT[getPriorityValue(first.priority)];
          if (priorityDiff !== 0) return priorityDiff;
        }

        const firstTime = getRequestActivityTime(first);
        const secondTime = getRequestActivityTime(second);
        return sortMode === 'oldest' ? firstTime - secondTime : secondTime - firstTime;
      });
  }, [allRequests, categoryFilter, priorityFilter, search, sortMode, statusFilter]);

  const openDetail = async (req: Request) => {
    setSelected(req);
    setChatAttachment(null);
    setStatusDraft(req.status);
    setPriorityDraft(getPriorityValue(req.priority));
    setAssignedDepartment(req.assigned_department || '');
    setOperatorNotes(req.operator_notes || '');
    setResolutionNotes(req.resolution_notes || '');
    try { const res = await apiService.getMessages(req.id); setMessages(res.data); } catch {}
  };

  const closeDetail = () => {
    setSelected(null);
    setMessages([]);
    setNewMessage('');
    setChatAttachment(null);
    setKeyboardHeight(0);
    setAssignedDepartment('');
    setOperatorNotes('');
    setResolutionNotes('');
  };

  useEffect(() => {
    if (!selected) return undefined;

    let isCancelled = false;
    let socket: WebSocket | null = null;

    AsyncStorage.getItem('token').then((token) => {
      if (!token || isCancelled) return;
      socket = new WebSocket(apiService.getMessageSocketUrl(selected.id, token));
      chatSocketRef.current = socket;
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === 'message' && payload.message) {
            setMessages((current) => mergeMessages(current, payload.message as Message));
          }
        } catch (error) {
          console.warn('Unable to parse chat socket message', error);
        }
      };
    });

    return () => {
      isCancelled = true;
      socket?.close();
      if (chatSocketRef.current === socket) {
        chatSocketRef.current = null;
      }
    };
  }, [selected]);

  const saveRequestUpdate = async () => {
    if (!selected) return;
    const trimmedResolution = resolutionNotes.trim();
    if (statusDraft === 'closed' && !trimmedResolution) {
      Alert.alert(t('common.error'), t('operator.closeCommentRequired'));
      return;
    }

    setIsUpdating(true);
    try {
      await apiService.updateRequestOperator(selected.id, {
        status: statusDraft,
        priority: priorityDraft,
        assigned_department: assignedDepartment.trim() || undefined,
        operator_notes: operatorNotes.trim() || undefined,
        resolution_notes: statusDraft === 'closed' ? trimmedResolution : undefined,
      });
      Alert.alert(t('common.success'), t('operator.updateSuccess'));
      closeDetail();
      fetchRequests();
    } catch { Alert.alert(t('common.error'), t('operator.updateFailed')); }
    finally { setIsUpdating(false); }
  };

  const pickChatMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
      base64: true,
    });

    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.base64) {
      return;
    }

    setChatAttachment({
      uri: asset.uri,
      dataUrl: `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`,
      label: asset.fileName || 'image.jpg',
      type: 'image',
    });
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !chatAttachment) || !selected || isSending) return;
    setIsSending(true);
    try {
      const res = await apiService.sendMessage(selected.id, {
        content: newMessage.trim(),
        attachment_url: chatAttachment?.dataUrl,
        attachment_label: chatAttachment?.label,
        attachment_type: chatAttachment?.type,
      });
      setMessages((current) => mergeMessages(current, res.data));
      setNewMessage('');
      setChatAttachment(null);
    } catch {} finally { setIsSending(false); }
  };

  const counts = {
    total: allRequests.length,
    pending: allRequests.filter(r => r.status === 'pending').length,
    in_progress: allRequests.filter(r => r.status === 'in_progress').length,
    closed: allRequests.filter(r => r.status === 'closed').length
  };
  const statusStats: { key: Request['status'] | null; label: string; count: number; color: string }[] = [
    { key: null, label: t('common.all'), count: counts.total, color: ORANGE },
    { key: 'pending', label: t('status.pending'), count: counts.pending, color: '#FF9500' },
    { key: 'in_progress', label: t('status.inProgress'), count: counts.in_progress, color: '#007AFF' },
    { key: 'closed', label: t('status.closed'), count: counts.closed, color: '#34C759' },
  ];
  const statsColumns = viewportWidth >= 340 ? 4 : 2;
  const availableStatsWidth = Math.max(viewportWidth - (STATS_HORIZONTAL_PADDING * 2), 0);
  const statCardWidth = (availableStatsWidth - STATS_GAP * (statsColumns - 1)) / statsColumns;
  const activeFilterCount = (categoryFilter ? 1 : 0) + (priorityFilter ? 1 : 0) + (sortMode !== 'newest' ? 1 : 0);
  const renderPriorityBadge = (priorityValue?: Request['priority']) => {
    const priority = getPriorityValue(priorityValue);
    const meta = PRIORITY_META[priority];
    return (
      <View style={[styles.priorityBadge, { backgroundColor: meta.background, borderColor: meta.border }]}>
        <Text style={[styles.priorityText, { color: meta.text }]}>
          {localizeRequestPriority(priority, t)}
        </Text>
      </View>
    );
  };

  const renderCard = ({ item }: { item: Request }) => {
    const priority = getPriorityValue(item.priority);
    return (
      <TouchableOpacity style={styles.card} onPress={() => openDetail(item)} activeOpacity={0.8} data-testid={`op-req-${item.id}`}>
        <View style={[styles.cardStrip, { backgroundColor: PRIORITY_META[priority].strip }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle} numberOfLines={1}>{localizeProblemType(item.category_id, item.problem_type, t)}</Text>
            <View style={styles.cardBadges}>
              <StatusBadge status={item.status} size="small" />
              {renderPriorityBadge(priority)}
            </View>
          </View>
          <Text style={styles.cardAddress} numberOfLines={1}>{item.address}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardDate}>{format(new Date(item.updated_at || item.created_at), 'dd.MM.yy HH:mm')}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) return <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={ORANGE} /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} data-testid="operator-dashboard-title">{t('operator.dashboard')}</Text>
        <Text style={styles.headerSub}>{t('operator.requestsCount', { count: counts.total })}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {statusStats.map(s => (
          <TouchableOpacity
            key={s.key || 'all'}
            style={[
              styles.statCard,
              { width: statCardWidth },
              statusFilter === s.key && styles.statCardActive,
            ]}
            onPress={() => setStatusFilter(s.key)}
          >
            <Text style={[styles.statNum, { color: s.color }]}>{s.count}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.filterPanel}>
        <View style={styles.filterTopRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={17} color="#8E8E93" />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={t('operator.searchPlaceholder')}
              placeholderTextColor="#B8B8BE"
            />
          </View>
          <TouchableOpacity style={styles.filterButton} onPress={() => setFilterSheetVisible(true)}>
            <Ionicons name="options-outline" size={18} color={ORANGE} />
            <Text style={styles.filterButtonText}>
              {activeFilterCount ? `${t('common.filter')} · ${activeFilterCount}` : t('common.filter')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList data={filteredRequests} keyExtractor={i => i.id} renderItem={renderCard}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); fetchRequests(); }} tintColor={ORANGE} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        ListEmptyComponent={<View style={styles.emptyBox}><Ionicons name="checkbox-outline" size={48} color="#C7C7CC" /><Text style={styles.emptyText}>{t('operator.noRequests')}</Text></View>}
      />

      <OperatorFilterSheet
        visible={filterSheetVisible}
        categories={categories}
        selectedCategory={categoryFilter}
        selectedPriority={priorityFilter}
        selectedSort={sortMode}
        onClose={() => setFilterSheetVisible(false)}
        onReset={() => {
          setCategoryFilter(null);
          setPriorityFilter(null);
          setSortMode('newest');
        }}
        onApply={({ category, priority, sort }) => {
          setCategoryFilter(category);
          setPriorityFilter(priority);
          setSortMode(sort);
        }}
      />

      {/* Detail Modal */}
      {selected && (
        <Modal visible animationType="slide" presentationStyle="pageSheet">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? undefined : 'height'}
            style={[styles.modalContainer, { paddingTop: insets.top || 16 }]}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeDetail} style={styles.closeBtn}><Ionicons name="close" size={24} color="#1C1C1E" /></TouchableOpacity>
              <Text style={styles.modalTitle}>{t('myRequests.details')}</Text>
              <View style={{ width: 44 }} />
            </View>
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('request.problem')}</Text>
                <Text style={styles.detailValue}>{localizeProblemType(selected.category_id, selected.problem_type, t)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('request.location')}</Text>
                <Text style={styles.detailValue}>{selected.address}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('request.category')}</Text>
                <Text style={styles.detailValue}>{localizeCategory(selected.category_id || selected.category_name, t)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('operator.filterByStatus')}</Text>
                <StatusBadge status={statusDraft} />
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('operator.filterByPriority')}</Text>
                {renderPriorityBadge(priorityDraft)}
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('myRequests.created')}</Text>
                <Text style={styles.detailValue}>{format(new Date(selected.created_at), 'dd.MM.yyyy HH:mm')}</Text>
              </View>
              <Text style={styles.descText}>{localizeRequestDescription(selected.description, selected.category_id, selected.problem_type, selected.reason, t)}</Text>

              {/* Status Actions */}
              <Text style={styles.sectionTitle}>{t('operator.updateStatus')}</Text>
              <View style={styles.statusBtns}>
                {STATUSES.map(s => (
                  <TouchableOpacity key={s} style={[styles.statusBtn, statusDraft === s && styles.statusBtnActive, { borderColor: ({ pending: '#FF9500', in_progress: '#007AFF', closed: '#34C759' } as Record<Request['status'], string>)[s] }]}
                    onPress={() => setStatusDraft(s)} disabled={isUpdating}>
                    <Text style={[styles.statusBtnText, statusDraft === s && styles.statusBtnTextActive]}>{t(getStatusTranslationKey(s))}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionTitle}>{t('operator.priority')}</Text>
              <View style={styles.statusBtns}>
                {PRIORITIES.map((priority) => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.statusBtn,
                      priorityDraft === priority && styles.statusBtnActive,
                      {
                        borderColor: PRIORITY_META[priority].border,
                        backgroundColor: priorityDraft === priority ? PRIORITY_META[priority].background : '#FFF',
                      },
                    ]}
                    onPress={() => setPriorityDraft(priority)}
                    disabled={isUpdating}
                  >
                    <Text style={[styles.statusBtnText, priorityDraft === priority && { color: PRIORITY_META[priority].text }]}>
                      {localizeRequestPriority(priority, t)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionTitle}>{t('operator.assignDepartment')}</Text>
              <TextInput
                style={styles.singleInput}
                value={assignedDepartment}
                onChangeText={setAssignedDepartment}
                placeholder={t('operator.departmentPlaceholder')}
                placeholderTextColor="#C7C7CC"
              />

              {/* Operator Notes */}
              <Text style={styles.sectionTitle}>{t('operator.internalNotes')}</Text>
              <TextInput style={styles.notesInput} multiline numberOfLines={3} value={operatorNotes} onChangeText={setOperatorNotes} placeholder={t('operator.internalNotesPlaceholder')} placeholderTextColor="#C7C7CC" />

              <Text style={styles.sectionTitle}>{t('operator.closeComment')}</Text>
              <TextInput
                style={styles.notesInput}
                multiline
                numberOfLines={4}
                value={resolutionNotes}
                onChangeText={setResolutionNotes}
                placeholder={t('operator.closeCommentPlaceholder')}
                placeholderTextColor="#C7C7CC"
              />
              <Text style={styles.helperText}>
                {statusDraft === 'closed' ? t('operator.closeCommentHelper') : t('operator.closeCommentOptional')}
              </Text>

              <TouchableOpacity
                style={[styles.saveButton, isUpdating && styles.saveButtonDisabled]}
                onPress={saveRequestUpdate}
                disabled={isUpdating}
              >
                <Text style={styles.saveButtonText}>{isUpdating ? t('common.loading') : t('operator.saveChanges')}</Text>
              </TouchableOpacity>

              {/* Chat */}
              <Text style={styles.sectionTitle}>{t('myRequests.chat')}</Text>
              {messages.length === 0 ? <Text style={styles.noMsg}>{t('myRequests.noMessages')}</Text> : messages.map(msg => (
                <View key={msg.id} style={[styles.msgBubble, msg.sender_type === 'operator' ? styles.opMsg : styles.userMsg]}>
                  <Text style={styles.msgSender}>{msg.sender_name || (msg.sender_type === 'operator' ? t('auth.operator') : t('operator.citizen'))}</Text>
                  <Text style={[styles.msgText, msg.sender_type === 'operator' && { color: '#FFF' }]}>{msg.content}</Text>
                  <Text style={[styles.msgTime, msg.sender_type === 'operator' && { color: 'rgba(255,255,255,0.7)' }]}>{format(new Date(msg.created_at), 'HH:mm')}</Text>
                  {msg.attachment_url ? (
                    <Image source={{ uri: msg.attachment_url }} style={styles.msgImage} />
                  ) : null}
                </View>
              ))}
            </ScrollView>
            <View style={[styles.messageComposer, { marginBottom: keyboardLift }]}>
              {chatAttachment ? (
                <View style={styles.pendingAttachment}>
                  <Image source={{ uri: chatAttachment.uri }} style={styles.pendingAttachmentImage} />
                  <Text style={styles.pendingAttachmentText} numberOfLines={1}>{chatAttachment.label}</Text>
                  <TouchableOpacity onPress={() => setChatAttachment(null)} style={styles.pendingAttachmentRemove}>
                    <Ionicons name="close" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>
              ) : null}
              <View style={[styles.msgInputRow, { paddingBottom: keyboardLift ? 12 : insets.bottom || 16 }]}>
                <TouchableOpacity style={styles.attachButton} onPress={pickChatMedia}>
                  <Ionicons name="image-outline" size={21} color={ORANGE} />
                </TouchableOpacity>
                <TextInput style={styles.msgInput} value={newMessage} onChangeText={setNewMessage} placeholder={t('operator.replyPlaceholder')} placeholderTextColor="#C7C7CC" multiline />
                <TouchableOpacity
                  style={[styles.sendBtn, ((!newMessage.trim() && !chatAttachment) || isSending) && { opacity: 0.5 }]}
                  onPress={sendMessage}
                  disabled={(!newMessage.trim() && !chatAttachment) || isSending}
                >
                  <Ionicons name="send" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E' },
  headerSub: { fontSize: 15, color: '#8E8E93', marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    paddingHorizontal: STATS_HORIZONTAL_PADDING,
    marginBottom: 12,
    gap: STATS_GAP,
  },
  statCard: {
    minHeight: 68,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardActive: { backgroundColor: `${ORANGE}10`, borderColor: ORANGE },
  statNum: { fontSize: 18, lineHeight: 20, fontWeight: '700' },
  statLabel: { marginTop: 4, fontSize: 10, lineHeight: 12, color: '#8E8E93', textAlign: 'center' },
  filterPanel: { paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  filterTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchBox: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1C1C1E', fontWeight: '600' },
  filterButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${ORANGE}55`,
    backgroundColor: '#FFF7F0',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  filterButtonText: { color: ORANGE, fontSize: 13, fontWeight: '800' },
  list: { paddingHorizontal: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 14, marginBottom: 10, flexDirection: 'row', overflow: 'hidden' },
  cardStrip: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', flex: 1, marginRight: 8 },
  cardBadges: { alignItems: 'flex-end', gap: 6 },
  cardAddress: { fontSize: 13, color: '#8E8E93', marginBottom: 6 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: 12, color: '#C7C7CC' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  priorityText: { fontSize: 10, fontWeight: '700' },
  emptyBox: { alignItems: 'center', padding: 60 },
  emptyText: { fontSize: 16, color: '#8E8E93', marginTop: 12 },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 18,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    color: '#111827',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  sheetReset: {
    color: ORANGE,
    fontSize: 13,
    fontWeight: '800',
  },
  sheetScroll: { maxHeight: 430 },
  sheetScrollContent: { paddingBottom: 10 },
  sheetSection: { gap: 12 },
  sheetSectionTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sheetSeparator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  sheetPillRow: { gap: 10, paddingRight: 18 },
  sheetPill: {
    minHeight: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPillActive: {
    borderColor: ORANGE,
    backgroundColor: `${ORANGE}12`,
  },
  sheetPillText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '800',
  },
  sheetPillTextActive: { color: '#111827' },
  sheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sheetGridButton: {
    minHeight: 44,
    minWidth: '47%',
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetGridButtonActive: {
    borderColor: ORANGE,
    backgroundColor: `${ORANGE}12`,
  },
  sheetGridText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  sheetGridTextActive: { color: '#111827' },
  sheetSortRow: { gap: 10 },
  sheetSortButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetSortButtonActive: {
    borderColor: ORANGE,
    backgroundColor: ORANGE,
  },
  sheetSortText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
  },
  sheetSortTextActive: { color: '#FFF' },
  sheetApplyButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  sheetApplyText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#1C1C1E' },
  modalBody: { flex: 1, padding: 16 },
  modalBodyContent: { paddingBottom: 24 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  detailLabel: { fontSize: 14, color: '#8E8E93' },
  detailValue: { fontSize: 15, fontWeight: '500', color: '#1C1C1E', flex: 1, textAlign: 'right', marginLeft: 16 },
  descText: { fontSize: 15, color: '#3C3C43', lineHeight: 22, marginTop: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 12 },
  statusBtns: { flexDirection: 'row', gap: 8 },
  statusBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 2, alignItems: 'center' },
  statusBtnActive: { backgroundColor: '#F2F2F7' },
  statusBtnText: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  statusBtnTextActive: { color: '#8E8E93' },
  singleInput: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, fontSize: 15, color: '#1C1C1E' },
  notesInput: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, fontSize: 15, color: '#1C1C1E', minHeight: 80, textAlignVertical: 'top' },
  helperText: { marginTop: 8, color: '#8E8E93', fontSize: 12, fontWeight: '600' },
  saveButton: { marginTop: 18, borderRadius: 14, backgroundColor: ORANGE, paddingVertical: 15, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  noMsg: { fontSize: 14, color: '#8E8E93', fontStyle: 'italic' },
  msgBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 8 },
  opMsg: { alignSelf: 'flex-end', backgroundColor: ORANGE },
  userMsg: { alignSelf: 'flex-start', backgroundColor: '#F2F2F7' },
  msgSender: { fontSize: 11, fontWeight: '600', color: '#8E8E93', marginBottom: 4 },
  msgText: { fontSize: 15, lineHeight: 20, color: '#1C1C1E' },
  msgTime: { fontSize: 11, color: '#8E8E93', marginTop: 4, textAlign: 'right' },
  msgImage: {
    width: 210,
    height: 150,
    borderRadius: 14,
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  pendingAttachment: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${ORANGE}30`,
    backgroundColor: `${ORANGE}10`,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pendingAttachmentImage: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  pendingAttachmentText: {
    flex: 1,
    color: '#1C1C1E',
    fontSize: 13,
    fontWeight: '700',
  },
  pendingAttachmentRemove: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageComposer: {
    backgroundColor: '#FFF',
  },
  msgInputRow: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#F2F2F7', alignItems: 'flex-end', gap: 12 },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7F0',
    borderWidth: 1,
    borderColor: `${ORANGE}35`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgInput: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, maxHeight: 100, color: '#1C1C1E' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
});

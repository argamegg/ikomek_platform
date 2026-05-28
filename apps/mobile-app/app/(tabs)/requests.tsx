import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { apiService, Request, Message } from '../../src/utils/api';
import { AIAssistantHeaderButton } from '../../src/components/AIAssistantWidget';
import { RequestCard } from '../../src/components/RequestCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import {
  REQUEST_CATEGORIES,
  localizeCategory,
  localizeProblemType,
  localizeReason,
  localizeRequestDescription,
} from '../../src/utils/requestLocalization';
import { localizeRequestPriority } from '../../src/utils/requestMeta';

const ORANGE = '#FF6B00';
const REQUESTS_PAGE_SIZE = 8;

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  electricity: 'flash',
  water: 'water',
  roads: 'car',
  public_order: 'shield-checkmark',
  sewage: 'water',
  waste: 'trash',
  heating: 'flame',
  street_lighting: 'bulb',
  other: 'ellipsis-horizontal'
};

const PRIORITY_BADGE_STYLES = {
  low: { background: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
  medium: { background: '#FEF9C3', text: '#CA8A04', border: '#FDE047' },
  high: { background: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' },
} as const;

type SortMode = 'newest' | 'oldest' | 'priority';
type RequestPriorityFilter = 'all' | 'low' | 'medium' | 'high';

const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };
const formatRequestId = (id?: string | null) => (id ? `#${id.slice(0, 8)}` : '#—');

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

export default function RequestsScreen() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatAttachment, setChatAttachment] = useState<ChatAttachment | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState<RequestPriorityFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSending, setIsSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const chatSocketRef = useRef<WebSocket | null>(null);
  
  const insets = useSafeAreaInsets();
  const keyboardLift = Platform.OS === 'ios' ? keyboardHeight : 0;

  const fetchRequests = useCallback(async () => {
    try {
      const response = await apiService.getUserRequests();
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

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

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchRequests();
  };

  const openRequestDetail = async (request: Request) => {
    setSelectedRequest(request);
    setChatAttachment(null);
    try {
      const response = await apiService.getMessages(request.id);
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  useEffect(() => {
    if (!selectedRequest) return undefined;

    let isCancelled = false;
    let socket: WebSocket | null = null;

    AsyncStorage.getItem('token').then((token) => {
      if (!token || isCancelled) return;
      socket = new WebSocket(apiService.getMessageSocketUrl(selectedRequest.id, token));
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
  }, [selectedRequest]);

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
    if ((!newMessage.trim() && !chatAttachment) || !selectedRequest || isSending) return;
    
    setIsSending(true);
    try {
      const response = await apiService.sendMessage(selectedRequest.id, {
        content: newMessage.trim(),
        attachment_url: chatAttachment?.dataUrl,
        attachment_label: chatAttachment?.label,
        attachment_type: chatAttachment?.type,
      });
      setMessages((current) => mergeMessages(current, response.data));
      setNewMessage('');
      setChatAttachment(null);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const filters = [
    { key: null, label: t('common.all') },
    { key: 'pending', label: t('status.pending'), color: '#FF9500' },
    { key: 'in_progress', label: t('status.inProgress'), color: '#007AFF' },
    { key: 'closed', label: t('status.closed'), color: '#34C759' }
  ];

  const categoryOptions = useMemo(
    () => REQUEST_CATEGORIES.map((category) => ({
      id: category.id,
      label: localizeCategory(category.id, t),
    })),
    [t],
  );

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return requests
      .filter((request) => {
        const matchesStatus = !filter || request.status === filter;
        const matchesCategory = categoryFilter === 'all' || request.category_id === categoryFilter;
        const priority = request.priority ?? 'medium';
        const matchesPriority = priorityFilter === 'all' || priority === priorityFilter;
        const searchable = [
          request.id,
          request.address,
          request.description,
          localizeProblemType(request.category_id, request.problem_type, t),
          localizeCategory(request.category_id || request.category_name, t),
        ].join(' ').toLowerCase();
        const matchesSearch = !query || searchable.includes(query);
        return matchesStatus && matchesCategory && matchesPriority && matchesSearch;
      })
      .slice()
      .sort((first, second) => {
        if (sortMode === 'oldest') {
          return new Date(first.created_at).getTime() - new Date(second.created_at).getTime();
        }
        if (sortMode === 'priority') {
          const priorityDiff = (PRIORITY_WEIGHT[second.priority ?? 'medium'] ?? 2) - (PRIORITY_WEIGHT[first.priority ?? 'medium'] ?? 2);
          if (priorityDiff !== 0) return priorityDiff;
        }
        return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
      });
  }, [categoryFilter, filter, priorityFilter, requests, searchQuery, sortMode, t]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, filter, priorityFilter, searchQuery, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / REQUESTS_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRequests = useMemo(() => {
    const start = (safeCurrentPage - 1) * REQUESTS_PAGE_SIZE;
    return filteredRequests.slice(start, start + REQUESTS_PAGE_SIZE);
  }, [filteredRequests, safeCurrentPage]);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  const hasActiveFilters = Boolean(filter) || categoryFilter !== 'all' || priorityFilter !== 'all' || sortMode !== 'newest';

  const renderRequestDetail = () => {
    if (!selectedRequest) return null;

    const categoryIcon = CATEGORY_ICONS[selectedRequest.category_id] || 'ellipsis-horizontal';
    const detailProblem = localizeProblemType(selectedRequest.category_id, selectedRequest.problem_type, t);
    const detailCategory = localizeCategory(selectedRequest.category_id || selectedRequest.category_name, t);
    const detailReason = localizeReason(selectedRequest.category_id, selectedRequest.reason, t);
    const detailDescription = localizeRequestDescription(
      selectedRequest.description,
      selectedRequest.category_id,
      selectedRequest.problem_type,
      selectedRequest.reason,
      t,
    );
    const detailPriority = selectedRequest.priority ?? 'medium';
    const detailPriorityStyle = PRIORITY_BADGE_STYLES[detailPriority] ?? PRIORITY_BADGE_STYLES.medium;

    return (
      <Modal visible={!!selectedRequest} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? undefined : 'height'}
          style={styles.modalContainer}
        >
          <View style={[styles.modalHeader, { paddingTop: insets.top || 16 }]}>
            <TouchableOpacity
              onPress={() => {
                setSelectedRequest(null);
                setMessages([]);
                setNewMessage('');
                setChatAttachment(null);
                setKeyboardHeight(0);
              }}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#1C1C1E" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('myRequests.details')}</Text>
            <View style={{ width: 44 }} />
          </View>
          
          <ScrollView
            style={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <View style={styles.detailHeader}>
              <View style={styles.detailIconContainer}>
                <Ionicons name={categoryIcon} size={24} color={ORANGE} />
              </View>
              <View style={styles.detailHeaderText}>
                <Text style={styles.detailRequestId}>{formatRequestId(selectedRequest.id)}</Text>
                <Text style={styles.detailTitle}>{detailProblem}</Text>
                <Text style={styles.detailCategory}>{detailCategory}</Text>
              </View>
              <View style={styles.detailBadges}>
                <StatusBadge status={selectedRequest.status} />
                <View style={[styles.priorityBadge, { backgroundColor: detailPriorityStyle.background, borderColor: detailPriorityStyle.border }]}>
                  <Text style={[styles.priorityText, { color: detailPriorityStyle.text }]}>
                    {localizeRequestPriority(detailPriority, t)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>{t('myRequests.location')}</Text>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color="#8E8E93" />
                <Text style={styles.infoText}>{selectedRequest.address}</Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>{t('myRequests.detailsSection')}</Text>
              <View style={styles.infoRow}>
                <Ionicons name="document-text-outline" size={18} color="#8E8E93" />
                <Text style={styles.infoText}>{detailReason}</Text>
              </View>
              <Text style={styles.description}>{detailDescription}</Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>{t('myRequests.timeline')}</Text>
              <View style={styles.timeline}>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: '#34C759' }]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>{t('myRequests.created')}</Text>
                    <Text style={styles.timelineDate}>
                      {format(new Date(selectedRequest.created_at), 'dd.MM.yyyy HH:mm')}
                    </Text>
                  </View>
                </View>
                {selectedRequest.status !== 'pending' && (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: '#007AFF' }]} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineTitle}>{t('myRequests.processing')}</Text>
                      <Text style={styles.timelineDate}>
                        {format(new Date(selectedRequest.updated_at), 'dd.MM.yyyy HH:mm')}
                      </Text>
                    </View>
                  </View>
                )}
                {selectedRequest.status === 'closed' && selectedRequest.closed_at && (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: '#34C759' }]} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineTitle}>{t('myRequests.resolved')}</Text>
                      <Text style={styles.timelineDate}>
                        {format(new Date(selectedRequest.closed_at), 'dd.MM.yyyy HH:mm')}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {selectedRequest.resolution_notes && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>{t('myRequests.resolution')}</Text>
                <Text style={styles.description}>{selectedRequest.resolution_notes}</Text>
              </View>
            )}

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>{t('myRequests.chat')}</Text>
              {messages.length === 0 ? (
                <Text style={styles.noMessages}>{t('myRequests.noMessages')}</Text>
              ) : (
                messages.map((msg) => (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageBubble,
                      msg.sender_type === 'user' ? styles.userMessage : styles.operatorMessage
                    ]}
                  >
                    <Text style={[
                      styles.messageText,
                      msg.sender_type === 'user' ? styles.userMessageText : styles.operatorMessageText
                    ]}>
                      {msg.content}
                    </Text>
                    <Text style={[
                      styles.messageTime,
                      msg.sender_type === 'user' ? styles.userMessageTime : styles.operatorMessageTime
                    ]}>
                      {format(new Date(msg.created_at), 'HH:mm')}
                    </Text>
                    {msg.attachment_url ? (
                      <TouchableOpacity activeOpacity={0.9}>
                        <Image source={{ uri: msg.attachment_url }} style={styles.messageImage} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              )}
            </View>
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
            <View style={[styles.messageInputContainer, { paddingBottom: keyboardLift ? 12 : insets.bottom || 16 }]}>
              <TouchableOpacity style={styles.attachButton} onPress={pickChatMedia}>
                <Ionicons name="image-outline" size={21} color={ORANGE} />
              </TouchableOpacity>
              <TextInput
                style={styles.messageInput}
                placeholder={t('myRequests.typeMessage')}
                placeholderTextColor="#C7C7CC"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendButton, ((!newMessage.trim() && !chatAttachment) || isSending) && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={(!newMessage.trim() && !chatAttachment) || isSending}
              >
                <Ionicons name="send" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>{t('myRequests.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('myRequests.totalRequestsCount', { count: filteredRequests.length })}</Text>
        </View>
        <AIAssistantHeaderButton />
      </View>

      <View style={styles.searchPanel}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('myRequests.searchPlaceholder')}
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
              <Ionicons name="close" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.filterTrigger, hasActiveFilters && styles.filterTriggerActive]}
          onPress={() => setIsFilterOpen(true)}
          activeOpacity={0.78}
        >
          <Ionicons name="options-outline" size={18} color={hasActiveFilters ? '#FFF' : ORANGE} />
          <Text style={[styles.filterTriggerText, hasActiveFilters && styles.filterTriggerTextActive]}>
            {t('common.filter')}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={paginatedRequests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RequestCard request={item} onPress={() => openRequestDetail(item)} />
        )}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={ORANGE} />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        ListHeaderComponent={
          filteredRequests.length > 0 ? (
            <Text style={styles.pageHint}>
              {t('myRequests.pageHint', { page: safeCurrentPage, total: totalPages })}
            </Text>
          ) : null
        }
        ListFooterComponent={
          filteredRequests.length > REQUESTS_PAGE_SIZE ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.paginationButton, safeCurrentPage <= 1 && styles.paginationButtonDisabled]}
                disabled={safeCurrentPage <= 1}
                onPress={() => setCurrentPage((page) => Math.max(1, page - 1))}
                activeOpacity={0.76}
              >
                <Text style={[styles.paginationButtonText, safeCurrentPage <= 1 && styles.paginationButtonTextDisabled]}>
                  {t('common.back')}
                </Text>
              </TouchableOpacity>
              <Text style={styles.paginationCount}>{safeCurrentPage} / {totalPages}</Text>
              <TouchableOpacity
                style={[styles.paginationButton, safeCurrentPage >= totalPages && styles.paginationButtonDisabled]}
                disabled={safeCurrentPage >= totalPages}
                onPress={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                activeOpacity={0.76}
              >
                <Text style={[styles.paginationButtonText, safeCurrentPage >= totalPages && styles.paginationButtonTextDisabled]}>
                  {t('common.continue')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyText}>{t('myRequests.noRequestsYet')}</Text>
            <Text style={styles.emptySubtext}>{t('myRequests.createFirst')}</Text>
          </View>
        }
      />

      <Modal visible={isFilterOpen} transparent animationType="slide" onRequestClose={() => setIsFilterOpen(false)}>
        <View style={styles.filterOverlay}>
          <Pressable style={styles.filterBackdrop} onPress={() => setIsFilterOpen(false)} />
          <View style={[styles.filterSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.filterHandle} />
            <View style={styles.filterSheetHeader}>
              <View>
                <Text style={styles.filterSheetTitle}>{t('myRequests.filtersTitle')}</Text>
                <Text style={styles.filterSheetSubtitle}>{t('myRequests.resultCount', { count: filteredRequests.length })}</Text>
              </View>
              <TouchableOpacity
                style={styles.filterReset}
                onPress={() => {
                  setFilter(null);
                  setCategoryFilter('all');
                  setPriorityFilter('all');
                  setSortMode('newest');
                }}
                activeOpacity={0.78}
              >
                <Text style={styles.filterResetText}>{t('myRequests.resetFilters')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.filterSheetContent}>
              <Text style={styles.filterSectionTitle}>{t('myRequests.statusFilter')}</Text>
              <View style={styles.optionGrid}>
                {filters.map((item) => {
                  const active = filter === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key || 'all'}
                      style={[styles.sheetOption, active && styles.sheetOptionActive]}
                      onPress={() => setFilter(item.key)}
                      activeOpacity={0.78}
                    >
                      {item.color ? <View style={[styles.sheetOptionDot, { backgroundColor: item.color }]} /> : <Ionicons name="apps-outline" size={16} color={active ? '#FFF' : '#64748B'} />}
                      <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.filterSectionTitle}>{t('myRequests.categoryFilter')}</Text>
              <View style={styles.optionGrid}>
                <TouchableOpacity
                  style={[styles.sheetOption, categoryFilter === 'all' && styles.sheetOptionActive]}
                  onPress={() => setCategoryFilter('all')}
                  activeOpacity={0.78}
                >
                  <Ionicons name="grid-outline" size={16} color={categoryFilter === 'all' ? '#FFF' : '#64748B'} />
                  <Text style={[styles.sheetOptionText, categoryFilter === 'all' && styles.sheetOptionTextActive]}>{t('myRequests.allCategories')}</Text>
                </TouchableOpacity>
                {categoryOptions.map((item) => {
                  const active = categoryFilter === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.sheetOption, active && styles.sheetOptionActive]}
                      onPress={() => setCategoryFilter(item.id)}
                      activeOpacity={0.78}
                    >
                      <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]} numberOfLines={1}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.filterSectionTitle}>{t('myRequests.priorityFilter')}</Text>
              <View style={styles.optionGrid}>
                {(['all', 'high', 'medium', 'low'] as RequestPriorityFilter[]).map((item) => {
                  const active = priorityFilter === item;
                  const label = item === 'all' ? t('myRequests.allPriorities') : localizeRequestPriority(item, t);
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.sheetOption, active && styles.sheetOptionActive]}
                      onPress={() => setPriorityFilter(item)}
                      activeOpacity={0.78}
                    >
                      <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.filterSectionTitle}>{t('myRequests.sortLabel')}</Text>
              <View style={styles.optionGrid}>
                {([
                  ['newest', t('myRequests.sortNewest')],
                  ['oldest', t('myRequests.sortOldest')],
                  ['priority', t('myRequests.sortPriority')],
                ] as const).map(([item, label]) => {
                  const active = sortMode === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.sheetOption, active && styles.sheetOptionActive]}
                      onPress={() => setSortMode(item)}
                      activeOpacity={0.78}
                    >
                      <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.filterApply} onPress={() => setIsFilterOpen(false)} activeOpacity={0.82}>
              <Text style={styles.filterApplyText}>{t('myRequests.applyFilters')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {renderRequestDetail()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 20,
    paddingBottom: 12
  },
  headerTextBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E'
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
    marginTop: 4
  },
  searchPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12
  },
  searchBox: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    paddingVertical: 0
  },
  searchClear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9'
  },
  filterTrigger: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#FFF4EC',
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.2)'
  },
  filterTriggerActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE
  },
  filterTriggerText: {
    fontSize: 13,
    fontWeight: '900',
    color: ORANGE
  },
  filterTriggerTextActive: {
    color: '#FFF'
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6
  },
  filterButtonActive: {
    backgroundColor: ORANGE
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  filterText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500'
  },
  filterTextActive: {
    color: '#FFF'
  },
  listContent: {
    paddingTop: 4
  },
  pageHint: {
    marginHorizontal: 18,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B'
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12
  },
  paginationButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#FFF4EC',
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.18)'
  },
  paginationButtonDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0'
  },
  paginationButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: ORANGE
  },
  paginationButtonTextDisabled: {
    color: '#94A3B8'
  },
  paginationCount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827'
  },
  filterOverlay: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.38)'
  },
  filterSheet: {
    maxHeight: '84%',
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFF'
  },
  filterHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    marginBottom: 16
  },
  filterSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  filterSheetTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827'
  },
  filterSheetSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B'
  },
  filterReset: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: '#FFF4EC',
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.18)'
  },
  filterResetText: {
    fontSize: 13,
    fontWeight: '900',
    color: ORANGE
  },
  filterSheetContent: {
    paddingTop: 18,
    paddingBottom: 16,
    gap: 14
  },
  filterSectionTitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '900',
    color: '#94A3B8',
    textTransform: 'uppercase'
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  sheetOption: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  sheetOptionActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE
  },
  sheetOptionDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5
  },
  sheetOptionText: {
    maxWidth: 190,
    fontSize: 13,
    fontWeight: '900',
    color: '#475569'
  },
  sheetOptionTextActive: {
    color: '#FFF'
  },
  filterApply: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: ORANGE
  },
  filterApplyText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 4,
    textAlign: 'center'
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7'
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E'
  },
  modalContent: {
    flex: 1,
    padding: 16
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  detailIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: `${ORANGE}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  detailHeaderText: {
    flex: 1,
    minWidth: 0
  },
  detailBadges: {
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 10
  },
  detailRequestId: {
    fontSize: 11,
    fontWeight: '900',
    color: ORANGE,
    marginBottom: 3
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '700'
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E'
  },
  detailCategory: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2
  },
  detailSection: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
    lineHeight: 22
  },
  description: {
    fontSize: 15,
    color: '#3C3C43',
    lineHeight: 22,
    marginTop: 8
  },
  timeline: {
    borderLeftWidth: 2,
    borderLeftColor: '#F2F2F7',
    marginLeft: 8,
    paddingLeft: 20
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    left: -27,
    top: 2
  },
  timelineContent: {
    flex: 1
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1C1C1E'
  },
  timelineDate: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2
  },
  noMessages: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic'
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: ORANGE
  },
  operatorMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2F2F7'
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20
  },
  userMessageText: {
    color: '#FFF'
  },
  operatorMessageText: {
    color: '#1C1C1E'
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4
  },
  userMessageTime: {
    color: 'rgba(255,255,255,0.7)'
  },
  operatorMessageTime: {
    color: '#8E8E93'
  },
  messageImage: {
    width: 210,
    height: 150,
    borderRadius: 14,
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.08)'
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
    gap: 10
  },
  pendingAttachmentImage: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E5E7EB'
  },
  pendingAttachmentText: {
    flex: 1,
    color: '#1C1C1E',
    fontSize: 13,
    fontWeight: '700'
  },
  pendingAttachmentRemove: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  messageComposer: {
    backgroundColor: '#FFF'
  },
  messageInputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    alignItems: 'flex-end',
    gap: 12
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7F0',
    borderWidth: 1,
    borderColor: `${ORANGE}35`,
    alignItems: 'center',
    justifyContent: 'center'
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    color: '#1C1C1E'
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendButtonDisabled: {
    opacity: 0.5
  }
});

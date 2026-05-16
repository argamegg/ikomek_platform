import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
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
  localizeCategory,
  localizeProblemType,
  localizeReason,
  localizeRequestDescription,
} from '../../src/utils/requestLocalization';
import { localizeRequestPriority } from '../../src/utils/requestMeta';

const ORANGE = '#FF6B00';

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  electricity: 'flash',
  water: 'water',
  roads: 'car',
  public_order: 'shield-checkmark',
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
  const [isSending, setIsSending] = useState(false);
  const chatSocketRef = useRef<WebSocket | null>(null);
  
  const insets = useSafeAreaInsets();

  const fetchRequests = useCallback(async () => {
    try {
      const response = await apiService.getUserRequests();
      let data = response.data;
      
      if (filter) {
        data = data.filter(r => r.status === filter);
      }
      
      setRequests(data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={[styles.modalHeader, { paddingTop: insets.top || 16 }]}>
            <TouchableOpacity
              onPress={() => {
                setSelectedRequest(null);
                setMessages([]);
                setNewMessage('');
                setChatAttachment(null);
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

          {chatAttachment ? (
            <View style={styles.pendingAttachment}>
              <Image source={{ uri: chatAttachment.uri }} style={styles.pendingAttachmentImage} />
              <Text style={styles.pendingAttachmentText} numberOfLines={1}>{chatAttachment.label}</Text>
              <TouchableOpacity onPress={() => setChatAttachment(null)} style={styles.pendingAttachmentRemove}>
                <Ionicons name="close" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={[styles.messageInputContainer, { paddingBottom: insets.bottom || 16 }]}>
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
          <Text style={styles.headerSubtitle}>{t('myRequests.totalRequestsCount', { count: requests.length })}</Text>
        </View>
        <AIAssistantHeaderButton />
      </View>

      <View style={styles.filterContainer}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key || 'all'}
            style={[styles.filterButton, filter === f.key && styles.filterButtonActive]}
            onPress={() => setFilter(f.key)}
          >
            {f.color && <View style={[styles.filterDot, { backgroundColor: f.color }]} />}
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RequestCard request={item} onPress={() => openRequestDetail(item)} />
        )}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={ORANGE} />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyText}>{t('myRequests.noRequestsYet')}</Text>
            <Text style={styles.emptySubtext}>{t('myRequests.createFirst')}</Text>
          </View>
        }
      />

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

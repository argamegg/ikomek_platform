import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, TextInput, Alert, useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { apiService, type Request, type Message, type RequestPriority } from '../../src/utils/api';
import { StatusBadge } from '../../src/components/StatusBadge';
import {
  getStatusTranslationKey,
  localizeCategory,
  localizeProblemType,
  localizeRequestDescription,
} from '../../src/utils/requestLocalization';
import { localizeRequestPriority } from '../../src/utils/requestMeta';

const ORANGE = '#FF6B00';
const STATUSES = ['pending', 'in_progress', 'closed'];
const PRIORITY_META: Record<RequestPriority, { background: string; text: string; border: string; strip: string }> = {
  low: { background: '#F3F4F6', text: '#6B7280', border: '#D1D5DB', strip: '#6B7280' },
  medium: { background: '#FEF9C3', text: '#CA8A04', border: '#FDE047', strip: '#CA8A04' },
  high: { background: '#FEE2E2', text: '#DC2626', border: '#FCA5A5', strip: '#DC2626' },
};
const STATS_HORIZONTAL_PADDING = 16;
const STATS_GAP = 8;

function getRequestActivityTime(request: Request) {
  const updated = new Date(request.updated_at || '').getTime();
  if (Number.isFinite(updated)) return updated;

  const created = new Date(request.created_at).getTime();
  return Number.isFinite(created) ? created : 0;
}

export default function OperatorDashboard() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Request | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [operatorNotes, setOperatorNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

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

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const filteredRequests = useMemo(
    () => allRequests.filter((request) => !statusFilter || request.status === statusFilter),
    [allRequests, statusFilter],
  );

  const openDetail = async (req: Request) => {
    setSelected(req);
    setOperatorNotes(req.operator_notes || '');
    try { const res = await apiService.getMessages(req.id); setMessages(res.data); } catch {}
  };

  const updateStatus = async (newStatus: string) => {
    if (!selected) return;
    setIsUpdating(true);
    try {
      await apiService.updateRequestOperator(selected.id, {
        status: newStatus,
        operator_notes: operatorNotes || undefined
      });
      Alert.alert(t('common.success'), t('operator.statusUpdated', { status: t(getStatusTranslationKey(newStatus)) }));
      setSelected(null);
      fetchRequests();
    } catch { Alert.alert(t('common.error'), t('operator.updateFailed')); }
    finally { setIsUpdating(false); }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selected || isSending) return;
    setIsSending(true);
    try {
      const res = await apiService.sendMessage(selected.id, newMessage.trim());
      setMessages([...messages, res.data]);
      setNewMessage('');
    } catch {} finally { setIsSending(false); }
  };

  const counts = {
    total: allRequests.length,
    pending: allRequests.filter(r => r.status === 'pending').length,
    in_progress: allRequests.filter(r => r.status === 'in_progress').length,
    closed: allRequests.filter(r => r.status === 'closed').length
  };
  const statsColumns = viewportWidth >= 340 ? 4 : 2;
  const availableStatsWidth = Math.max(viewportWidth - (STATS_HORIZONTAL_PADDING * 2), 0);
  const statCardWidth = (availableStatsWidth - STATS_GAP * (statsColumns - 1)) / statsColumns;
  const getPriorityValue = (priority?: Request['priority']) => priority ?? 'medium';
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
        {[{ key: null, label: t('common.all'), count: counts.total, color: ORANGE },
          { key: 'pending', label: t('status.pending'), count: counts.pending, color: '#FF9500' },
          { key: 'in_progress', label: t('status.inProgress'), count: counts.in_progress, color: '#007AFF' },
          { key: 'closed', label: t('status.closed'), count: counts.closed, color: '#34C759' }
        ].map(s => (
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

      <FlatList data={filteredRequests} keyExtractor={i => i.id} renderItem={renderCard}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); fetchRequests(); }} tintColor={ORANGE} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        ListEmptyComponent={<View style={styles.emptyBox}><Ionicons name="checkbox-outline" size={48} color="#C7C7CC" /><Text style={styles.emptyText}>{t('operator.noRequests')}</Text></View>}
      />

      {/* Detail Modal */}
      {selected && (
        <Modal visible animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modalContainer, { paddingTop: insets.top || 16 }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}><Ionicons name="close" size={24} color="#1C1C1E" /></TouchableOpacity>
              <Text style={styles.modalTitle}>{t('myRequests.details')}</Text>
              <View style={{ width: 44 }} />
            </View>
            <ScrollView style={styles.modalBody}>
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
                <StatusBadge status={selected.status} />
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('operator.filterByPriority')}</Text>
                {renderPriorityBadge(selected.priority)}
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
                  <TouchableOpacity key={s} style={[styles.statusBtn, selected.status === s && styles.statusBtnActive, { borderColor: ({ pending: '#FF9500', in_progress: '#007AFF', closed: '#34C759' } as any)[s] }]}
                    onPress={() => updateStatus(s)} disabled={isUpdating || selected.status === s}>
                    <Text style={[styles.statusBtnText, selected.status === s && styles.statusBtnTextActive]}>{t(getStatusTranslationKey(s))}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Operator Notes */}
              <Text style={styles.sectionTitle}>{t('operator.internalNotes')}</Text>
              <TextInput style={styles.notesInput} multiline numberOfLines={3} value={operatorNotes} onChangeText={setOperatorNotes} placeholder={t('operator.internalNotesPlaceholder')} placeholderTextColor="#C7C7CC" />

              {/* Chat */}
              <Text style={styles.sectionTitle}>{t('myRequests.chat')}</Text>
              {messages.length === 0 ? <Text style={styles.noMsg}>{t('myRequests.noMessages')}</Text> : messages.map(msg => (
                <View key={msg.id} style={[styles.msgBubble, msg.sender_type === 'operator' ? styles.opMsg : styles.userMsg]}>
                  <Text style={styles.msgSender}>{msg.sender_name || (msg.sender_type === 'operator' ? t('auth.operator') : t('operator.citizen'))}</Text>
                  <Text style={[styles.msgText, msg.sender_type === 'operator' && { color: '#FFF' }]}>{msg.content}</Text>
                  <Text style={[styles.msgTime, msg.sender_type === 'operator' && { color: 'rgba(255,255,255,0.7)' }]}>{format(new Date(msg.created_at), 'HH:mm')}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={[styles.msgInputRow, { paddingBottom: insets.bottom || 16 }]}>
              <TextInput style={styles.msgInput} value={newMessage} onChangeText={setNewMessage} placeholder={t('operator.replyPlaceholder')} placeholderTextColor="#C7C7CC" multiline />
              <TouchableOpacity style={[styles.sendBtn, (!newMessage.trim() || isSending) && { opacity: 0.5 }]} onPress={sendMessage} disabled={!newMessage.trim() || isSending}>
                <Ionicons name="send" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
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
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#1C1C1E' },
  modalBody: { flex: 1, padding: 16 },
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
  notesInput: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, fontSize: 15, color: '#1C1C1E', minHeight: 80, textAlignVertical: 'top' },
  noMsg: { fontSize: 14, color: '#8E8E93', fontStyle: 'italic' },
  msgBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 8 },
  opMsg: { alignSelf: 'flex-end', backgroundColor: ORANGE },
  userMsg: { alignSelf: 'flex-start', backgroundColor: '#F2F2F7' },
  msgSender: { fontSize: 11, fontWeight: '600', color: '#8E8E93', marginBottom: 4 },
  msgText: { fontSize: 15, lineHeight: 20, color: '#1C1C1E' },
  msgTime: { fontSize: 11, color: '#8E8E93', marginTop: 4, textAlign: 'right' },
  msgInputRow: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#F2F2F7', alignItems: 'flex-end', gap: 12 },
  msgInput: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, maxHeight: 100, color: '#1C1C1E' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
});

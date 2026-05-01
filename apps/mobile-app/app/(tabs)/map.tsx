import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Modal, FlatList, useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { apiService, MapPoint } from '../../src/utils/api';
import { RequestsMap } from '../../src/components/RequestsMap';
import { StatusBadge } from '../../src/components/StatusBadge';
import { localizeProblemType } from '../../src/utils/requestLocalization';

const ORANGE = '#FF6B00';

const CATEGORY_COLORS: Record<string, string> = {
  electricity: '#FFB300', water: '#2196F3', heating: '#FF5722',
  public_order: '#4CAF50', sewage: '#607D8B', waste: '#795548',
  roads: '#9E9E9E', other: '#9E9E9E'
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9500', in_progress: '#007AFF', closed: '#34C759'
};

export default function MapScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width <= 430;
  const isTablet = width >= 768;
  const horizontalPadding = isTablet ? 24 : 16;
  const mapBottomClearance = Math.max(insets.bottom + 112, isTablet ? 132 : 116);

  const [points, setPoints] = useState<MapPoint[]>([]);
  const [filteredPoints, setFilteredPoints] = useState<MapPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'my'>('all');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  const loadPoints = useCallback(async () => {
    try {
      const response = await apiService.getMapPoints();
      setPoints(response.data);
    } catch (error) {
      console.error('Error loading points:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadPoints(); }, [loadPoints]);

  useEffect(() => {
    let filtered = points;
    if (filter === 'my') filtered = filtered.filter(p => p.is_mine);
    if (statusFilter) filtered = filtered.filter(p => p.status === statusFilter);
    setFilteredPoints(filtered);
  }, [points, filter, statusFilter]);

  const counts = {
    pending: points.filter(p => p.status === 'pending').length,
    in_progress: points.filter(p => p.status === 'in_progress').length,
    closed: points.filter(p => p.status === 'closed').length
  };

  const renderPointCard = ({ item }: { item: MapPoint }) => {
    const catColor = CATEGORY_COLORS[item.category] || '#9E9E9E';
    const statusColor = STATUS_COLORS[item.status] || '#FF9500';
    const title = localizeProblemType(item.category, item.title, t);
    return (
      <TouchableOpacity style={styles.pointCard} onPress={() => setSelectedPoint(item)} activeOpacity={0.8} data-testid={`point-card-${item.id}`}>
        <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
        <View style={styles.pointContent}>
          <View style={styles.pointHeader}>
            <View style={styles.pointMeta}>
              <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
              <View style={styles.pointInfo}>
                <Text style={styles.pointTitle} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
                <Text style={styles.pointAddress} numberOfLines={1} ellipsizeMode="tail">{item.address}</Text>
              </View>
            </View>
            <View style={styles.pointBadge}>
              <StatusBadge status={item.status as any} size="small" />
            </View>
          </View>
          <Text style={styles.pointDate}>{format(new Date(item.created_at), 'dd.MM.yy')}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={ORANGE} /></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
        <Text style={styles.headerTitle} data-testid="map-title">{t('nav.map')}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.viewToggle, viewMode === 'map' && styles.viewToggleActive]} onPress={() => setViewMode('map')} data-testid="map-view-toggle">
            <Ionicons name="map" size={18} color={viewMode === 'map' ? '#FFF' : '#64748B'} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.viewToggle, viewMode === 'list' && styles.viewToggleActive]} onPress={() => setViewMode('list')} data-testid="list-view-toggle">
            <Ionicons name="list" size={18} color={viewMode === 'list' ? '#FFF' : '#64748B'} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.controlsStack}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
          contentContainerStyle={[styles.statsContent, { paddingHorizontal: horizontalPadding }]}
        >
          <TouchableOpacity style={[styles.statChip, !statusFilter && styles.statChipActive]} onPress={() => setStatusFilter(null)}>
            <Text style={[styles.statNum, !statusFilter && { color: ORANGE }]}>{points.length}</Text>
            <Text style={styles.statLabel}>{t('common.all')}</Text>
          </TouchableOpacity>
          {[['pending', counts.pending], ['in_progress', counts.in_progress], ['closed', counts.closed]].map(([key, count]) => (
            <TouchableOpacity
              key={key as string}
              style={[styles.statChip, statusFilter === key && styles.statChipActive]}
              onPress={() => setStatusFilter(statusFilter === key ? null : key as string)}
            >
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[key as string] }]} />
              <Text style={styles.statNum}>{count as number}</Text>
              <Text style={styles.statLabel}>{t(`status.${key === 'in_progress' ? 'inProgress' : key}`)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.filterBar, { paddingHorizontal: horizontalPadding }]}>
          <View style={styles.filterToggle}>
            <TouchableOpacity style={[styles.toggleBtn, filter === 'all' && styles.toggleBtnActive]} onPress={() => setFilter('all')}>
              <Text style={[styles.toggleText, filter === 'all' && styles.toggleTextActive]}>{t('map.allRequests')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, filter === 'my' && styles.toggleBtnActive]} onPress={() => setFilter('my')}>
              <Text style={[styles.toggleText, filter === 'my' && styles.toggleTextActive]}>{t('map.myRequests')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadPoints} data-testid="refresh-btn">
            <Ionicons name="refresh" size={18} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'map' ? (
        <View style={[styles.mapContainer, { marginHorizontal: horizontalPadding, marginBottom: mapBottomClearance }]}>
          <RequestsMap
            points={filteredPoints}
            categoryColors={CATEGORY_COLORS}
            statusColors={STATUS_COLORS}
            onPointPress={setSelectedPoint}
          />
          <View style={[styles.legend, isCompact && styles.legendCompact]}>
            {Object.entries(STATUS_COLORS).map(([key, color]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{t(`status.${key === 'in_progress' ? 'inProgress' : key}`)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={[styles.listSurface, { marginHorizontal: horizontalPadding, marginBottom: mapBottomClearance }]}>
          <FlatList
            style={styles.list}
            data={filteredPoints}
            keyExtractor={(item) => item.id}
            renderItem={renderPointCard}
            contentContainerStyle={[styles.listContent, { paddingBottom: 20 }]}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="map-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyText}>{t('myRequests.noRequests')}</Text>
              </View>
            }
          />
        </View>
      )}

      {/* Point Detail Modal */}
      {selectedPoint && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={[styles.modalCatIcon, { backgroundColor: `${CATEGORY_COLORS[selectedPoint.category] || '#9E9E9E'}20` }]}>
                  <Ionicons name="location" size={24} color={CATEGORY_COLORS[selectedPoint.category] || '#9E9E9E'} />
                </View>
                <View style={{ flex: 1, marginLeft: 14, gap: 6 }}>
                  <Text style={styles.modalTitle}>{localizeProblemType(selectedPoint.category, selectedPoint.title, t)}</Text>
                  <StatusBadge status={selectedPoint.status as any} />
                </View>
                <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedPoint(null)}>
                  <Ionicons name="close" size={24} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <View style={styles.infoRow}><Ionicons name="location" size={18} color={ORANGE} /><Text style={styles.infoText}>{selectedPoint.address}</Text></View>
                <View style={styles.infoRow}><Ionicons name="time-outline" size={18} color="#8E8E93" /><Text style={styles.infoText}>{format(new Date(selectedPoint.created_at), 'dd.MM.yyyy HH:mm')}</Text></View>
                <View style={styles.infoRow}><Ionicons name="navigate-outline" size={18} color="#8E8E93" /><Text style={styles.infoText}>{selectedPoint.lat.toFixed(5)}, {selectedPoint.lng.toFixed(5)}</Text></View>
                {selectedPoint.is_mine && (
                  <View style={styles.myBadge}><Ionicons name="checkmark-circle" size={16} color={ORANGE} /><Text style={styles.myBadgeText}>{t('map.yourRequest')}</Text></View>
                )}
              </View>
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
  header: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 6, zIndex: 2 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827', letterSpacing: -0.6 },
  headerRight: { flexDirection: 'row', backgroundColor: 'rgba(255, 255, 255, 0.88)', borderRadius: 18, padding: 4, borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.06)' },
  viewToggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  viewToggleActive: { backgroundColor: ORANGE },
  controlsStack: { gap: 10, paddingBottom: 10 },
  statsScroll: { width: '100%', flexGrow: 0, zIndex: 2 },
  statsContent: { gap: 10, paddingRight: 16 },
  statChip: { height: 44, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.92)', borderRadius: 16, paddingHorizontal: 14, gap: 7, minWidth: 88, flexShrink: 0, borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.05)' },
  statChipActive: { backgroundColor: '#FFF4EC', borderWidth: 1, borderColor: ORANGE, shadowColor: ORANGE, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 3 },
  statusDot: { width: 9, height: 9, borderRadius: 4.5 },
  statNum: { minWidth: 18, fontSize: 15, fontWeight: '800', color: '#111827', textAlign: 'center' },
  statLabel: { flexShrink: 1, fontSize: 12, color: '#475569', fontWeight: '500' },
  filterBar: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 2 },
  filterToggle: { flex: 1, minWidth: 0, flexDirection: 'row', backgroundColor: 'rgba(255, 255, 255, 0.88)', borderRadius: 18, padding: 4, borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.06)' },
  toggleBtn: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 14 },
  toggleBtnActive: { backgroundColor: '#FFF' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  toggleTextActive: { color: '#111827' },
  refreshBtn: { width: 42, height: 42, flexShrink: 0, borderRadius: 21, backgroundColor: 'rgba(255, 255, 255, 0.92)', borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.06)', alignItems: 'center', justifyContent: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 2 },
  mapContainer: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#F8FAFC', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.06)', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.08, shadowRadius: 26, elevation: 6 },
  listModeSurface: { backgroundColor: '#FFF' },
  mapLoading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },
  mapLoadingText: { marginTop: 8, fontSize: 14, color: '#8E8E93' },
  legend: { position: 'absolute', left: 12, right: 12, bottom: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(255, 255, 255, 0.86)', borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.05)', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 4 },
  legendCompact: { gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: '#334155', fontWeight: '600' },
  listSurface: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.06)', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.08, shadowRadius: 26, elevation: 6 },
  list: { flex: 1, width: '100%', backgroundColor: 'transparent' },
  listContent: { paddingHorizontal: 16, paddingTop: 16 },
  pointCard: { backgroundColor: '#FFF', borderRadius: 16, marginBottom: 10, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.05)' },
  statusIndicator: { width: 4 },
  pointContent: { flex: 1, minWidth: 0, padding: 14 },
  pointHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 10 },
  pointMeta: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  categoryDot: { width: 12, height: 12, borderRadius: 6 },
  pointInfo: { flex: 1, minWidth: 0, marginLeft: 10 },
  pointBadge: { flexShrink: 0, alignItems: 'flex-end' },
  pointTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  pointAddress: { fontSize: 12, color: '#64748B', marginTop: 2 },
  pointDate: { fontSize: 12, color: '#94A3B8' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 60 },
  emptyText: { fontSize: 16, color: '#475569', marginTop: 12, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHandle: { width: 36, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  modalCatIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#1C1C1E' },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  modalBody: { gap: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { flex: 1, fontSize: 15, color: '#3C3C43' },
  myBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${ORANGE}10`, padding: 10, borderRadius: 10, marginTop: 6 },
  myBadgeText: { fontSize: 14, fontWeight: '600', color: ORANGE },
});

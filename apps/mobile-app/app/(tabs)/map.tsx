import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Modal, useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { apiService, MapPoint } from '../../src/utils/api';
import { RequestsMap } from '../../src/components/RequestsMap';
import { StatusBadge } from '../../src/components/StatusBadge';
import { AIAssistantHeaderButton } from '../../src/components/AIAssistantWidget';
import { localizeCategory, localizeProblemType } from '../../src/utils/requestLocalization';

const ORANGE = '#FF6B00';

const CATEGORY_COLORS: Record<string, string> = {
  electricity: '#FFB300', water: '#2196F3', heating: '#FF5722',
  public_order: '#4CAF50', sewage: '#607D8B', waste: '#795548',
  street_lighting: '#FFC107', roads: '#9E9E9E', other: '#9E9E9E'
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9500', in_progress: '#007AFF', closed: '#34C759'
};

const ANALYTICS_MONTHS = 12;
const HOUR_MARKS = ['00', '06', '12', '18'];
const WEEKDAY_DATES = Array.from({ length: 7 }, (_, index) => new Date(Date.UTC(2024, 0, index + 1, 12)));
const LOCALE_TAGS = { ru: 'ru-RU', en: 'en-US', kz: 'kk-KZ' } as const;

type LocaleKey = keyof typeof LOCALE_TAGS;

const normalizeLocale = (language?: string): LocaleKey => {
  if (language?.startsWith('en')) return 'en';
  if (language?.startsWith('kz') || language?.startsWith('kk')) return 'kz';
  return 'ru';
};

const parsePointDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getMonthKey = (date: Date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
);

const getLastMonthKeys = (count: number) => {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return getMonthKey(date);
  });
};

const formatMonthLabel = (monthKey: string, locale: LocaleKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  try {
    return new Intl.DateTimeFormat(LOCALE_TAGS[locale], { month: 'short' }).format(date).replace('.', '');
  } catch {
    return monthKey.slice(5);
  }
};

const formatWeekdayLabel = (dayIndex: number, locale: LocaleKey) => {
  try {
    return new Intl.DateTimeFormat(LOCALE_TAGS[locale], { weekday: 'short' }).format(WEEKDAY_DATES[dayIndex]).replace('.', '');
  } catch {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayIndex];
  }
};

export default function MapScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isCompact = width <= 430;
  const isTablet = width >= 768;
  const horizontalPadding = isTablet ? 24 : 16;
  const contentBottomPadding = Math.max(insets.bottom + 112, isTablet ? 132 : 116);
  const mapHeight = isTablet ? Math.min(Math.round(height * 0.56), 560) : Math.max(340, Math.min(Math.round(height * 0.46), 440));
  const listMinHeight = Math.max(280, Math.min(mapHeight, isTablet ? 500 : 420));
  const locale = normalizeLocale(i18n.language);

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

  const analytics = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    const monthKeys = getLastMonthKeys(ANALYTICS_MONTHS);
    const timelineBuckets = new Map(monthKeys.map((key) => [key, {
      key,
      label: formatMonthLabel(key, locale),
      all: 0,
      pending: 0,
      closed: 0,
    }]));
    const hotspotBuckets = new Map<string, { address: string; count: number; point: MapPoint }>();
    const activityMatrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    const noAddress = t('map.analytics.noAddress');

    points.forEach((point) => {
      categoryTotals[point.category] = (categoryTotals[point.category] || 0) + 1;

      const date = parsePointDate(point.created_at);
      if (date) {
        const timelineBucket = timelineBuckets.get(getMonthKey(date));
        if (timelineBucket) {
          timelineBucket.all += 1;
          if (point.status === 'pending') timelineBucket.pending += 1;
          if (point.status === 'closed') timelineBucket.closed += 1;
        }

        const dayIndex = (date.getDay() + 6) % 7;
        activityMatrix[dayIndex][date.getHours()] += 1;
      }

      const address = point.address?.trim() || noAddress;
      const hotspot = hotspotBuckets.get(address);
      if (hotspot) {
        hotspot.count += 1;
      } else {
        hotspotBuckets.set(address, { address, count: 1, point });
      }
    });

    const categories = Object.entries(categoryTotals)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const timeline = Array.from(timelineBuckets.values());
    const hotspots = Array.from(hotspotBuckets.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);

    return {
      categories,
      maxCategory: Math.max(...categories.map((item) => item.count), 1),
      timeline,
      maxTimeline: Math.max(...timeline.map((item) => item.all), 1),
      hotspots,
      maxHotspot: Math.max(...hotspots.map((item) => item.count), 1),
      activityMatrix,
      maxActivity: Math.max(...activityMatrix.flat(), 1),
      total: points.length,
    };
  }, [locale, points, t]);

  const renderPointCard = (item: MapPoint) => {
    const catColor = CATEGORY_COLORS[item.category] || '#9E9E9E';
    const statusColor = STATUS_COLORS[item.status] || '#FF9500';
    const title = localizeProblemType(item.category, item.title, t);
    return (
      <TouchableOpacity key={item.id} style={styles.pointCard} onPress={() => setSelectedPoint(item)} activeOpacity={0.8} data-testid={`point-card-${item.id}`}>
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

  const renderAnalyticsEmpty = () => (
    <View style={styles.analyticsEmptyCard}>
      <Ionicons name="analytics-outline" size={32} color="#CBD5E1" />
      <Text style={styles.analyticsEmptyText}>{t('map.analytics.insufficientData')}</Text>
    </View>
  );

  if (isLoading) {
    return <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={ORANGE} /></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
        <Text style={styles.headerTitle} data-testid="map-title">{t('nav.map')}</Text>
        <View style={styles.headerActions}>
          <AIAssistantHeaderButton />
          <View style={styles.headerRight}>
            <TouchableOpacity style={[styles.viewToggle, viewMode === 'map' && styles.viewToggleActive]} onPress={() => setViewMode('map')} data-testid="map-view-toggle">
              <Ionicons name="map" size={18} color={viewMode === 'map' ? '#FFF' : '#64748B'} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.viewToggle, viewMode === 'list' && styles.viewToggleActive]} onPress={() => setViewMode('list')} data-testid="list-view-toggle">
              <Ionicons name="list" size={18} color={viewMode === 'list' ? '#FFF' : '#64748B'} />
            </TouchableOpacity>
          </View>
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

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === 'map' ? (
          <View style={[styles.mapContainer, { height: mapHeight, marginHorizontal: horizontalPadding }]}>
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
          <View style={[styles.listSurface, { minHeight: listMinHeight, marginHorizontal: horizontalPadding }]}>
            <View style={styles.listContent}>
              {filteredPoints.length > 0 ? filteredPoints.map(renderPointCard) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="map-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyText}>{t('myRequests.noRequests')}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={[styles.analyticsSection, { marginHorizontal: horizontalPadding }]}>
          <View style={styles.analyticsHeader}>
            <View style={styles.analyticsHeaderIcon}>
              <Ionicons name="analytics-outline" size={21} color={ORANGE} />
            </View>
            <View style={styles.analyticsHeaderText}>
              <Text style={styles.analyticsTitle}>{t('map.analytics.title')}</Text>
              <Text style={styles.analyticsSubtitle}>
                {t('map.analytics.seriesAll')} · {t('map.analytics.requestsCount', { count: analytics.total })}
              </Text>
            </View>
          </View>

          {analytics.total === 0 ? renderAnalyticsEmpty() : (
            <>
              <View style={styles.analyticsCard}>
                <View style={styles.analyticsCardHeader}>
                  <Ionicons name="grid-outline" size={18} color="#0F172A" />
                  <Text style={styles.analyticsCardTitle}>{t('map.analytics.categories')}</Text>
                </View>
                <View style={styles.analyticsRows}>
                  {analytics.categories.map((item) => {
                    const color = CATEGORY_COLORS[item.category] || '#9E9E9E';
                    return (
                      <View key={item.category} style={styles.analyticsRow}>
                        <View style={styles.analyticsRowTop}>
                          <View style={styles.analyticsRowLabel}>
                            <View style={[styles.analyticsDot, { backgroundColor: color }]} />
                            <Text style={styles.analyticsRowName} numberOfLines={1}>{localizeCategory(item.category, t)}</Text>
                          </View>
                          <Text style={styles.analyticsRowValue}>{t('map.analytics.requestsCount', { count: item.count })}</Text>
                        </View>
                        <View style={styles.analyticsBarTrack}>
                          <View style={[styles.analyticsBarFill, { width: `${Math.max((item.count / analytics.maxCategory) * 100, 8)}%`, backgroundColor: color }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.analyticsCard}>
                <View style={styles.analyticsCardHeader}>
                  <Ionicons name="trending-up-outline" size={18} color="#0F172A" />
                  <Text style={styles.analyticsCardTitle}>{t('map.analytics.timeline')}</Text>
                </View>
                <View style={styles.timelineChart}>
                  {analytics.timeline.map((item) => (
                    <View key={item.key} style={styles.timelineColumn}>
                      <View style={styles.timelineBars}>
                        <View style={[styles.timelineBar, { height: Math.max((item.all / analytics.maxTimeline) * 82, item.all ? 8 : 2), backgroundColor: '#CBD5E1' }]} />
                        <View style={[styles.timelineBar, { height: Math.max((item.pending / analytics.maxTimeline) * 82, item.pending ? 8 : 2), backgroundColor: STATUS_COLORS.pending }]} />
                        <View style={[styles.timelineBar, { height: Math.max((item.closed / analytics.maxTimeline) * 82, item.closed ? 8 : 2), backgroundColor: STATUS_COLORS.closed }]} />
                      </View>
                      <Text style={styles.timelineLabel} numberOfLines={1}>{item.label}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.analyticsLegendRow}>
                  <View style={styles.analyticsLegendItem}><View style={[styles.analyticsLegendDot, { backgroundColor: '#CBD5E1' }]} /><Text style={styles.analyticsLegendText}>{t('map.analytics.seriesAll')}</Text></View>
                  <View style={styles.analyticsLegendItem}><View style={[styles.analyticsLegendDot, { backgroundColor: STATUS_COLORS.pending }]} /><Text style={styles.analyticsLegendText}>{t('status.pending')}</Text></View>
                  <View style={styles.analyticsLegendItem}><View style={[styles.analyticsLegendDot, { backgroundColor: STATUS_COLORS.closed }]} /><Text style={styles.analyticsLegendText}>{t('status.closed')}</Text></View>
                </View>
              </View>

              <View style={styles.analyticsCard}>
                <View style={styles.analyticsCardHeader}>
                  <Ionicons name="location-outline" size={18} color="#0F172A" />
                  <Text style={styles.analyticsCardTitle}>{t('map.analytics.hotspots')}</Text>
                </View>
                <View style={styles.hotspotList}>
                  {analytics.hotspots.map((item, index) => (
                    <TouchableOpacity key={`${item.address}-${index}`} style={styles.hotspotRow} activeOpacity={0.78} onPress={() => setSelectedPoint(item.point)}>
                      <View style={styles.hotspotRank}>
                        <Text style={styles.hotspotRankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.hotspotInfo}>
                        <View style={styles.hotspotTop}>
                          <Text style={styles.hotspotAddress} numberOfLines={1}>{item.address}</Text>
                          <Text style={styles.hotspotCount}>{t('map.analytics.requestsCount', { count: item.count })}</Text>
                        </View>
                        <View style={styles.analyticsBarTrack}>
                          <View style={[styles.analyticsBarFill, { width: `${Math.max((item.count / analytics.maxHotspot) * 100, 8)}%`, backgroundColor: ORANGE }]} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.analyticsCard}>
                <View style={styles.analyticsCardHeader}>
                  <Ionicons name="time-outline" size={18} color="#0F172A" />
                  <Text style={styles.analyticsCardTitle}>{t('map.analytics.activity')}</Text>
                </View>
                <View style={styles.heatmapHourRow}>
                  <View style={styles.heatmapDayLabelSpacer} />
                  {HOUR_MARKS.map((hour) => (
                    <Text key={hour} style={styles.heatmapHour}>{hour}</Text>
                  ))}
                </View>
                <View style={styles.heatmapGrid}>
                  {analytics.activityMatrix.map((row, dayIndex) => (
                    <View key={dayIndex} style={styles.heatmapRow}>
                      <Text style={styles.heatmapDayLabel}>{formatWeekdayLabel(dayIndex, locale)}</Text>
                      <View style={styles.heatmapCells}>
                        {row.map((count, hour) => {
                          const intensity = count / analytics.maxActivity;
                          return (
                            <View
                              key={`${dayIndex}-${hour}`}
                              style={[
                                styles.heatmapCell,
                                {
                                  backgroundColor: count > 0 ? ORANGE : '#E2E8F0',
                                  opacity: count > 0 ? 0.24 + intensity * 0.68 : 0.45,
                                },
                              ]}
                            />
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  contentScroll: { flex: 1 },
  content: { gap: 18 },
  mapContainer: { position: 'relative', overflow: 'hidden', backgroundColor: '#F8FAFC', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.06)', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.08, shadowRadius: 26, elevation: 6 },
  listModeSurface: { backgroundColor: '#FFF' },
  mapLoading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },
  mapLoadingText: { marginTop: 8, fontSize: 14, color: '#8E8E93' },
  legend: { position: 'absolute', left: 12, right: 12, bottom: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(255, 255, 255, 0.86)', borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.05)', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 4 },
  legendCompact: { gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: '#334155', fontWeight: '600' },
  listSurface: { backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.06)', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.08, shadowRadius: 26, elevation: 6 },
  list: { flex: 1, width: '100%', backgroundColor: 'transparent' },
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
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
  analyticsSection: { gap: 14 },
  analyticsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  analyticsHeaderIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#FFF4EC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 107, 0, 0.18)' },
  analyticsHeaderText: { flex: 1, minWidth: 0 },
  analyticsTitle: { fontSize: 21, fontWeight: '800', color: '#111827' },
  analyticsSubtitle: { marginTop: 2, fontSize: 13, color: '#64748B', fontWeight: '600' },
  analyticsCard: { backgroundColor: 'rgba(255, 255, 255, 0.94)', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.06)', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 3 },
  analyticsEmptyCard: { minHeight: 130, backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.06)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  analyticsEmptyText: { marginTop: 10, fontSize: 14, fontWeight: '600', color: '#64748B', textAlign: 'center' },
  analyticsCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  analyticsCardTitle: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '800', color: '#111827' },
  analyticsRows: { gap: 14 },
  analyticsRow: { gap: 8 },
  analyticsRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  analyticsRowLabel: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  analyticsDot: { width: 10, height: 10, borderRadius: 5 },
  analyticsRowName: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '700', color: '#1E293B' },
  analyticsRowValue: { flexShrink: 0, fontSize: 12, fontWeight: '700', color: '#64748B' },
  analyticsBarTrack: { height: 7, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  analyticsBarFill: { height: '100%', borderRadius: 999 },
  timelineChart: { minHeight: 116, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 5 },
  timelineColumn: { flex: 1, minWidth: 0, alignItems: 'center', gap: 7 },
  timelineBars: { height: 86, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2 },
  timelineBar: { width: 4, borderRadius: 999 },
  timelineLabel: { width: '100%', fontSize: 9, color: '#64748B', textAlign: 'center', fontWeight: '700' },
  analyticsLegendRow: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  analyticsLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  analyticsLegendDot: { width: 8, height: 8, borderRadius: 4 },
  analyticsLegendText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  hotspotList: { gap: 12 },
  hotspotRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hotspotRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF4EC', alignItems: 'center', justifyContent: 'center' },
  hotspotRankText: { fontSize: 12, fontWeight: '800', color: ORANGE },
  hotspotInfo: { flex: 1, minWidth: 0, gap: 8 },
  hotspotTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  hotspotAddress: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '700', color: '#1E293B' },
  hotspotCount: { flexShrink: 0, fontSize: 12, fontWeight: '700', color: '#64748B' },
  heatmapHourRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  heatmapDayLabelSpacer: { width: 34 },
  heatmapHour: { flex: 1, fontSize: 10, color: '#94A3B8', fontWeight: '800', textAlign: 'center' },
  heatmapGrid: { gap: 7 },
  heatmapRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heatmapDayLabel: { width: 26, fontSize: 10, color: '#64748B', fontWeight: '800', textTransform: 'uppercase' },
  heatmapCells: { flex: 1, flexDirection: 'row', gap: 2 },
  heatmapCell: { flex: 1, height: 8, borderRadius: 2 },
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

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Modal, useWindowDimensions, PanResponder, Pressable
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { apiService, MapPoint } from '../../src/utils/api';
import { RequestsMap } from '../../src/components/RequestsMap';
import { StatusBadge } from '../../src/components/StatusBadge';
import { AIAssistantHeaderButton } from '../../src/components/AIAssistantWidget';
import { REQUEST_CATEGORIES, localizeCategory, localizeProblemType } from '../../src/utils/requestLocalization';

const ORANGE = '#FF6B00';

const CATEGORY_COLORS: Record<string, string> = {
  electricity: '#FFB300', water: '#2196F3', heating: '#FF5722',
  public_order: '#4CAF50', sewage: '#607D8B', waste: '#795548',
  street_lighting: '#FFC107', roads: '#9E9E9E', other: '#9E9E9E'
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9500', in_progress: '#007AFF', closed: '#34C759'
};

const TIMELINE_COLORS = {
  all: '#94A3B8',
  pending: '#FF9500',
  closed: '#34C759',
} as const;

const ANALYTICS_MONTHS = 12;
const HOUR_MARKS = ['00', '06', '12', '18'];
const WEEKDAY_DATES = Array.from({ length: 7 }, (_, index) => new Date(Date.UTC(2024, 0, index + 1, 12)));
const LOCALE_TAGS = { ru: 'ru-RU', en: 'en-US', kz: 'kk-KZ' } as const;
const MAX_DATE_RANGE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

type LocaleKey = keyof typeof LOCALE_TAGS;
type Hotspot = { address: string; count: number; points: MapPoint[] };
type CategoryOption = { id: string; label: string; color: string };
type StatusOption = { key: string; label: string; count: number; color: string };
type DateRange = { from: string; to: string };

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

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const diffCalendarDays = (from: Date, to: Date) => (
  Math.round((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / DAY_MS)
);

const toDateKey = (date: Date) => {
  const day = startOfLocalDay(date);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
};

const parseDateKey = (value?: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return startOfLocalDay(date);
};

const getDefaultDateRange = (): DateRange => {
  const today = startOfLocalDay(new Date());
  return {
    from: toDateKey(addDays(today, -(MAX_DATE_RANGE_DAYS - 1))),
    to: toDateKey(today),
  };
};

const normalizeDateRange = (range: DateRange): DateRange => {
  const fallback = getDefaultDateRange();
  const fromDate = parseDateKey(range.from);
  const toDate = parseDateKey(range.to);
  if (!fromDate && !toDate) return fallback;

  const today = startOfLocalDay(new Date());
  let start = startOfLocalDay(fromDate ?? toDate ?? today);
  let end = startOfLocalDay(toDate ?? fromDate ?? today);

  if (start > end) [start, end] = [end, start];
  if (end > today) end = today;
  if (start > today) start = today;
  if (diffCalendarDays(start, end) >= MAX_DATE_RANGE_DAYS) {
    end = addDays(start, MAX_DATE_RANGE_DAYS - 1);
  }
  if (end > today) {
    end = today;
    start = addDays(end, -(MAX_DATE_RANGE_DAYS - 1));
  }

  return { from: toDateKey(start), to: toDateKey(end) };
};

const isDefaultDateRange = (range: DateRange) => {
  const fallback = getDefaultDateRange();
  return range.from === fallback.from && range.to === fallback.to;
};

const getDateRangeBounds = (range: DateRange) => {
  const normalized = normalizeDateRange(range);
  const from = parseDateKey(normalized.from)!;
  const to = parseDateKey(normalized.to)!;
  return {
    dateFrom: startOfLocalDay(from).toISOString(),
    dateTo: endOfLocalDay(to).toISOString(),
  };
};

const isPointInDateRange = (point: MapPoint, range: DateRange) => {
  const createdAt = parsePointDate(point.created_at);
  const from = parseDateKey(range.from);
  const to = parseDateKey(range.to);
  return Boolean(createdAt && from && to && createdAt.getTime() >= startOfLocalDay(from).getTime() && createdAt.getTime() <= endOfLocalDay(to).getTime());
};

const getCalendarCells = (monthDate: Date) => {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const gridStart = addDays(monthStart, -startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return {
      date,
      key: toDateKey(date),
      inMonth: date.getMonth() === monthStart.getMonth(),
    };
  });
};

const formatCalendarMonth = (date: Date, locale: LocaleKey) => {
  try {
    return new Intl.DateTimeFormat(LOCALE_TAGS[locale], { month: 'long', year: 'numeric' }).format(date);
  } catch {
    return `${date.getMonth() + 1}.${date.getFullYear()}`;
  }
};

const formatDateRangeLabel = (range: DateRange, locale: LocaleKey) => {
  const from = parseDateKey(range.from);
  const to = parseDateKey(range.to);
  if (!from || !to) return '';
  try {
    if (range.from === range.to) {
      return new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: 'numeric', month: 'long', year: 'numeric' }).format(from);
    }
    if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
      const month = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { month: 'long', year: 'numeric' }).format(to);
      return `${from.getDate()}-${to.getDate()} ${month}`;
    }
    return `${new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: 'numeric', month: 'short' }).format(from)} - ${new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: 'numeric', month: 'short', year: 'numeric' }).format(to)}`;
  } catch {
    return range.from === range.to ? range.from : `${range.from} - ${range.to}`;
  }
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

function DateRangeCalendar({
  range,
  locale,
  onChange,
}: {
  range: DateRange;
  locale: LocaleKey;
  onChange: (range: DateRange) => void;
}) {
  const { t } = useTranslation();
  const selectedEnd = parseDateKey(range.to) ?? new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selectedEnd.getFullYear(), selectedEnd.getMonth(), 1));
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const today = startOfLocalDay(new Date());
  const rangeStart = parseDateKey(range.from);
  const rangeEnd = parseDateKey(range.to);

  useEffect(() => {
    const end = parseDateKey(range.to);
    if (end) setVisibleMonth(new Date(end.getFullYear(), end.getMonth(), 1));
    if (anchorKey && range.from !== anchorKey && range.to !== anchorKey) {
      setAnchorKey(null);
    }
  }, [anchorKey, range.from, range.to]);

  const cells = useMemo(() => getCalendarCells(visibleMonth), [visibleMonth]);
  const canGoNext = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1) <= new Date(today.getFullYear(), today.getMonth(), 1);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => formatWeekdayLabel(index, locale)), [locale]);

  const moveMonth = useCallback((delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setAnchorKey(null);
  }, []);

  const selectDate = useCallback((date: Date) => {
    const selectedKey = toDateKey(date);
    const anchor = anchorKey ? parseDateKey(anchorKey) : null;

    if (!anchor) {
      setAnchorKey(selectedKey);
      onChange({ from: selectedKey, to: selectedKey });
      return;
    }

    let start = anchor < date ? anchor : date;
    let end = anchor < date ? date : anchor;
    if (diffCalendarDays(start, end) >= MAX_DATE_RANGE_DAYS) {
      if (date >= anchor) {
        end = addDays(start, MAX_DATE_RANGE_DAYS - 1);
      } else {
        start = addDays(end, -(MAX_DATE_RANGE_DAYS - 1));
      }
    }

    setAnchorKey(null);
    onChange({ from: toDateKey(start), to: toDateKey(end) });
  }, [anchorKey, onChange]);

  return (
    <View style={styles.calendarBox}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity style={styles.calendarNav} onPress={() => moveMonth(-1)} activeOpacity={0.72}>
          <Ionicons name="chevron-back" size={19} color="#334155" />
        </TouchableOpacity>
        <View style={styles.calendarHeaderText}>
          <Text style={styles.calendarRangeLabel} numberOfLines={1}>{formatDateRangeLabel(range, locale)}</Text>
          <Text style={styles.calendarMonthLabel}>{formatCalendarMonth(visibleMonth, locale)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.calendarNav, !canGoNext && styles.calendarNavDisabled]}
          onPress={() => moveMonth(1)}
          disabled={!canGoNext}
          activeOpacity={0.72}
        >
          <Ionicons name="chevron-forward" size={19} color="#334155" />
        </TouchableOpacity>
      </View>
      <Text style={styles.calendarHelp}>{t('map.filters.dateRangeHelp')}</Text>
      <View style={styles.calendarWeekdays}>
        {weekdays.map((label) => <Text key={label} style={styles.calendarWeekday}>{label}</Text>)}
      </View>
      <View style={styles.calendarGrid}>
        {cells.map((cell) => {
          const cellDate = startOfLocalDay(cell.date);
          const isFuture = cellDate > today;
          const isStart = rangeStart ? cell.key === toDateKey(rangeStart) : false;
          const isEnd = rangeEnd ? cell.key === toDateKey(rangeEnd) : false;
          const isSelected = isStart || isEnd;
          const isInRange = Boolean(rangeStart && rangeEnd && cellDate > rangeStart && cellDate < rangeEnd);
          const isAnchor = anchorKey === cell.key;

          return (
            <TouchableOpacity
              key={cell.key}
              style={[
                styles.calendarDay,
                !cell.inMonth && styles.calendarDayMuted,
                isInRange && styles.calendarDayInRange,
                isSelected && styles.calendarDaySelected,
                isAnchor && styles.calendarDayAnchor,
                isFuture && styles.calendarDayDisabled,
              ]}
              onPress={() => selectDate(cellDate)}
              disabled={isFuture}
              activeOpacity={0.72}
            >
              <Text style={[
                styles.calendarDayText,
                !cell.inMonth && styles.calendarDayTextMuted,
                isInRange && styles.calendarDayTextInRange,
                isSelected && styles.calendarDayTextSelected,
              ]}>
                {cellDate.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

type MapFilterSheetProps = {
  visible: boolean;
  categoryOptions: CategoryOption[];
  statusOptions: StatusOption[];
  selectedCategory: string;
  selectedStatus: string | null;
  selectedDateRange: DateRange;
  resultCount: number;
  hasActiveFilters: boolean;
  bottomInset: number;
  onClose: () => void;
  onApply: (value: { category: string; status: string | null; dateRange: DateRange }) => void;
  onReset: () => void;
};

function MapFilterSheet({
  visible,
  categoryOptions,
  statusOptions,
  selectedCategory,
  selectedStatus,
  selectedDateRange,
  resultCount,
  hasActiveFilters,
  bottomInset,
  onClose,
  onApply,
  onReset,
}: MapFilterSheetProps) {
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const [draftCategory, setDraftCategory] = useState(selectedCategory);
  const [draftStatus, setDraftStatus] = useState<string | null>(selectedStatus);
  const [draftDateRange, setDraftDateRange] = useState<DateRange>(selectedDateRange);
  const translateY = useRef(new Animated.Value(0)).current;
  const statusTotal = statusOptions.reduce((sum, item) => sum + item.count, 0);
  const canResetFilters = hasActiveFilters || draftCategory !== 'all' || draftStatus !== null || !isDefaultDateRange(draftDateRange);

  useEffect(() => {
    if (visible) {
      setDraftCategory(selectedCategory);
      setDraftStatus(selectedStatus);
      setDraftDateRange(selectedDateRange);
      translateY.setValue(0);
    }
  }, [selectedCategory, selectedDateRange, selectedStatus, translateY, visible]);

  const closeAnimated = useCallback(() => {
    Animated.timing(translateY, {
      toValue: 520,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      translateY.setValue(0);
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeAnimated}>
      <View style={styles.mapFilterOverlay}>
        <Pressable style={styles.mapFilterBackdrop} onPress={closeAnimated} />
        <Animated.View
          style={[styles.mapFilterSheet, { paddingBottom: bottomInset + 18, transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.mapFilterHandle} />
          <View style={styles.mapFilterHeader}>
            <View style={styles.mapFilterHeaderText}>
              <Text style={styles.mapFilterTitle}>{t('map.filters.title')}</Text>
              <Text style={styles.mapFilterSubtitle}>{t('map.filters.resultCount', { count: resultCount })}</Text>
            </View>
            <TouchableOpacity
              style={[styles.mapFilterReset, !canResetFilters && styles.mapFilterResetDisabled]}
              onPress={() => {
                setDraftCategory('all');
                setDraftStatus(null);
                setDraftDateRange(getDefaultDateRange());
                onReset();
              }}
              disabled={!canResetFilters}
              activeOpacity={0.76}
            >
              <Text style={[styles.mapFilterResetText, !canResetFilters && styles.mapFilterResetTextDisabled]}>
                {t('map.filters.reset')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.mapFilterScroll} contentContainerStyle={styles.mapFilterScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.mapFilterSection}>
              <Text style={styles.mapFilterSectionTitle}>{t('map.filters.dateRange')}</Text>
              <DateRangeCalendar
                range={draftDateRange}
                locale={locale}
                onChange={(nextRange) => setDraftDateRange(normalizeDateRange(nextRange))}
              />
            </View>

            <View style={styles.mapFilterSeparator} />

            <View style={styles.mapFilterSection}>
              <Text style={styles.mapFilterSectionTitle}>{t('map.filters.categories')}</Text>
              <View style={styles.mapCategoryGrid}>
                <TouchableOpacity
                  style={[
                    styles.mapCategoryOption,
                    styles.mapCategoryOptionWide,
                    draftCategory === 'all' && styles.mapCategoryOptionActive,
                  ]}
                  onPress={() => setDraftCategory('all')}
                  activeOpacity={0.78}
                >
                  <View style={[styles.mapFilterOptionIcon, draftCategory === 'all' && styles.mapFilterOptionIconActive]}>
                    <Ionicons name="apps-outline" size={17} color={draftCategory === 'all' ? '#FFF' : '#64748B'} />
                  </View>
                  <Text style={[styles.mapCategoryOptionText, draftCategory === 'all' && styles.mapFilterOptionTextActive]}>
                    {t('map.filters.allCategories')}
                  </Text>
                  {draftCategory === 'all' ? <Ionicons name="checkmark-circle" size={20} color="#FFF" /> : null}
                </TouchableOpacity>

                {categoryOptions.map((item) => {
                  const active = draftCategory === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.mapCategoryOption, active && styles.mapCategoryOptionActive]}
                      onPress={() => setDraftCategory(item.id)}
                      activeOpacity={0.78}
                    >
                      <View style={[styles.mapCategoryOptionDot, { backgroundColor: active ? '#FFF' : item.color }]} />
                      <Text style={[styles.mapCategoryOptionText, active && styles.mapFilterOptionTextActive]} numberOfLines={2}>
                        {item.label}
                      </Text>
                      {active ? <Ionicons name="checkmark-circle" size={18} color="#FFF" /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.mapFilterSeparator} />

            <View style={styles.mapFilterSection}>
              <Text style={styles.mapFilterSectionTitle}>{t('map.filters.status')}</Text>
              <View style={styles.mapStatusGrid}>
                <TouchableOpacity
                  style={[styles.mapStatusOption, draftStatus === null && styles.mapStatusOptionActive]}
                  onPress={() => setDraftStatus(null)}
                  activeOpacity={0.78}
                >
                  <View style={[styles.mapStatusOptionDot, { backgroundColor: '#94A3B8' }]} />
                  <Text style={[styles.mapStatusOptionText, draftStatus === null && styles.mapStatusOptionTextActive]}>
                    {t('common.all')}
                  </Text>
                  <Text style={[styles.mapStatusOptionCount, draftStatus === null && styles.mapStatusOptionCountActive]}>
                    {statusTotal}
                  </Text>
                </TouchableOpacity>

                {statusOptions.map((item) => {
                  const active = draftStatus === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.mapStatusOption, active && styles.mapStatusOptionActive]}
                      onPress={() => setDraftStatus(active ? null : item.key)}
                      activeOpacity={0.78}
                    >
                      <View style={[styles.mapStatusOptionDot, { backgroundColor: item.color }]} />
                      <Text style={[styles.mapStatusOptionText, active && styles.mapStatusOptionTextActive]} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <Text style={[styles.mapStatusOptionCount, active && styles.mapStatusOptionCountActive]}>
                        {item.count}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.mapFilterApply}
            onPress={() => {
              onApply({ category: draftCategory, status: draftStatus, dateRange: normalizeDateRange(draftDateRange) });
              closeAnimated();
            }}
            activeOpacity={0.82}
          >
            <Text style={styles.mapFilterApplyText}>{t('map.filters.apply')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

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
  const contentScrollRef = useRef<ScrollView | null>(null);

  const [points, setPoints] = useState<MapPoint[]>([]);
  const [filteredPoints, setFilteredPoints] = useState<MapPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'my'>('all');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedTimelineMonth, setSelectedTimelineMonth] = useState<string | null>(null);
  const [activeHotspotAddress, setActiveHotspotAddress] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>(() => getDefaultDateRange());
  const [isMapFiltersOpen, setIsMapFiltersOpen] = useState(false);

  const loadPoints = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getMapPoints(getDateRangeBounds(dateRange));
      setPoints(response.data);
    } catch (error) {
      console.error('Error loading points:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { loadPoints(); }, [loadPoints]);

  useEffect(() => {
    let filtered = points.filter((point) => isPointInDateRange(point, dateRange));
    if (filter === 'my') filtered = filtered.filter(p => p.is_mine);
    if (statusFilter) filtered = filtered.filter(p => p.status === statusFilter);
    if (categoryFilter !== 'all') filtered = filtered.filter(p => p.category === categoryFilter);
    filtered = filtered.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setFilteredPoints(filtered);
  }, [categoryFilter, dateRange, filter, points, statusFilter]);

  const timeScopedPoints = useMemo(
    () => points.filter((point) => isPointInDateRange(point, dateRange)),
    [dateRange, points],
  );

  const ownershipPoints = useMemo(
    () => (filter === 'my' ? timeScopedPoints.filter((point) => point.is_mine) : timeScopedPoints),
    [filter, timeScopedPoints],
  );

  const counts = {
    pending: ownershipPoints.filter(p => p.status === 'pending').length,
    in_progress: ownershipPoints.filter(p => p.status === 'in_progress').length,
    closed: ownershipPoints.filter(p => p.status === 'closed').length
  };

  const categoryOptions = useMemo(
    () => REQUEST_CATEGORIES.map((category) => ({
      id: category.id,
      label: localizeCategory(category.id, t),
      color: CATEGORY_COLORS[category.id] || category.color,
    })),
    [t],
  );

  const mapFilterStatusOptions = useMemo(() => {
    const scopedPoints = timeScopedPoints.filter((point) => {
      const matchesOwnership = filter !== 'my' || point.is_mine;
      const matchesCategory = categoryFilter === 'all' || point.category === categoryFilter;
      return matchesOwnership && matchesCategory;
    });

    return [
      { key: 'pending', label: t('status.pending'), count: scopedPoints.filter((point) => point.status === 'pending').length, color: STATUS_COLORS.pending },
      { key: 'in_progress', label: t('status.inProgress'), count: scopedPoints.filter((point) => point.status === 'in_progress').length, color: STATUS_COLORS.in_progress },
      { key: 'closed', label: t('status.closed'), count: scopedPoints.filter((point) => point.status === 'closed').length, color: STATUS_COLORS.closed },
    ];
  }, [categoryFilter, filter, t, timeScopedPoints]);

  const hasMapFilters = Boolean(statusFilter) || categoryFilter !== 'all' || !isDefaultDateRange(dateRange);

  const clearMapFocus = useCallback(() => {
    setActiveHotspotAddress(null);
    setSelectedPoint(null);
  }, []);

  const updateOwnershipFilter = useCallback((nextFilter: 'all' | 'my') => {
    clearMapFocus();
    setFilter(nextFilter);
  }, [clearMapFocus]);

  const updateStatusFilter = useCallback((nextStatus: string | null) => {
    clearMapFocus();
    setStatusFilter(nextStatus);
  }, [clearMapFocus]);

  const resetMapFilters = useCallback(() => {
    clearMapFocus();
    setStatusFilter(null);
    setCategoryFilter('all');
    setDateRange(getDefaultDateRange());
  }, [clearMapFocus]);

  const applyMapFilters = useCallback((value: { category: string; status: string | null; dateRange: DateRange }) => {
    clearMapFocus();
    setCategoryFilter(value.category);
    setStatusFilter(value.status);
    setDateRange(normalizeDateRange(value.dateRange));
  }, [clearMapFocus]);

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
    const hotspotBuckets = new Map<string, Hotspot>();
    const activityMatrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    const noAddress = t('map.analytics.noAddress');

    ownershipPoints.forEach((point) => {
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
        hotspot.points.push(point);
      } else {
        hotspotBuckets.set(address, { address, count: 1, points: [point] });
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
      total: ownershipPoints.length,
    };
  }, [locale, ownershipPoints, t]);

  const analyticsScopeLabel = filter === 'my' ? t('map.myRequests') : t('map.analytics.seriesAll');

  const activeTimelineItem = useMemo(() => (
    analytics.timeline.find((item) => item.key === selectedTimelineMonth)
    || analytics.timeline.slice().reverse().find((item) => item.all > 0)
    || analytics.timeline[analytics.timeline.length - 1]
  ), [analytics.timeline, selectedTimelineMonth]);

  const activeHotspot = useMemo(
    () => analytics.hotspots.find((item) => item.address === activeHotspotAddress) ?? null,
    [activeHotspotAddress, analytics.hotspots],
  );

  const activeHotspotStatusSummary = useMemo(() => {
    if (!activeHotspot) return [];

    return ([
      { key: 'pending', label: t('status.pending'), count: activeHotspot.points.filter((point) => point.status === 'pending').length, color: STATUS_COLORS.pending },
      { key: 'in_progress', label: t('status.inProgress'), count: activeHotspot.points.filter((point) => point.status === 'in_progress').length, color: STATUS_COLORS.in_progress },
      { key: 'closed', label: t('status.closed'), count: activeHotspot.points.filter((point) => point.status === 'closed').length, color: STATUS_COLORS.closed },
    ]).filter((item) => item.count > 0);
  }, [activeHotspot, t]);

  const mapPoints = activeHotspot ? activeHotspot.points : filteredPoints;

  const focusHotspot = useCallback((hotspot: Hotspot) => {
    setViewMode('map');
    setSelectedPoint(null);
    setActiveHotspotAddress(hotspot.address);
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, []);

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
          <TouchableOpacity style={[styles.statChip, !statusFilter && styles.statChipActive]} onPress={() => updateStatusFilter(null)}>
            <Text style={[styles.statNum, !statusFilter && { color: ORANGE }]}>{ownershipPoints.length}</Text>
            <Text style={styles.statLabel}>{t('common.all')}</Text>
          </TouchableOpacity>
          {[['pending', counts.pending], ['in_progress', counts.in_progress], ['closed', counts.closed]].map(([key, count]) => (
            <TouchableOpacity
              key={key as string}
              style={[styles.statChip, statusFilter === key && styles.statChipActive]}
              onPress={() => updateStatusFilter(statusFilter === key ? null : key as string)}
            >
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[key as string] }]} />
              <Text style={styles.statNum}>{count as number}</Text>
              <Text style={styles.statLabel}>{t(`status.${key === 'in_progress' ? 'inProgress' : key}`)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.filterBar, { paddingHorizontal: horizontalPadding }]}>
          <View style={styles.filterToggle}>
            <TouchableOpacity style={[styles.toggleBtn, filter === 'all' && styles.toggleBtnActive]} onPress={() => updateOwnershipFilter('all')}>
              <Text style={[styles.toggleText, filter === 'all' && styles.toggleTextActive]}>{t('map.allRequests')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, filter === 'my' && styles.toggleBtnActive]} onPress={() => updateOwnershipFilter('my')}>
              <Text style={[styles.toggleText, filter === 'my' && styles.toggleTextActive]}>{t('map.myRequests')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadPoints} data-testid="refresh-btn">
            <Ionicons name="refresh" size={18} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={contentScrollRef}
        style={styles.contentScroll}
        contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === 'map' ? (
          <View style={[styles.mapContainer, { height: mapHeight, marginHorizontal: horizontalPadding }]}>
            <RequestsMap
              points={mapPoints}
              categoryColors={CATEGORY_COLORS}
              statusColors={STATUS_COLORS}
              onPointPress={setSelectedPoint}
              focusPoints={activeHotspot?.points ?? null}
            />
            <TouchableOpacity
              style={[styles.mapFilterFab, hasMapFilters && styles.mapFilterFabActive]}
              onPress={() => {
                setActiveHotspotAddress(null);
                setIsMapFiltersOpen(true);
              }}
              activeOpacity={0.76}
            >
              <Ionicons name="options-outline" size={18} color={hasMapFilters ? '#FFF' : '#475569'} />
              <Text style={[styles.mapFilterFabText, hasMapFilters && styles.mapFilterFabTextActive]}>
                {t('map.filters.show')}
              </Text>
            </TouchableOpacity>
            {activeHotspot ? (
              <View style={styles.hotspotMapCallout}>
                <View style={styles.hotspotMapHeader}>
                  <View style={styles.hotspotMapPin}>
                    <Ionicons name="location-outline" size={18} color={ORANGE} />
                  </View>
                  <View style={styles.hotspotMapTitleWrap}>
                    <Text style={styles.hotspotMapTitle} numberOfLines={1}>{activeHotspot.address}</Text>
                    <Text style={styles.hotspotMapSubtitle}>{t('map.analytics.requestsCount', { count: activeHotspot.count })}</Text>
                  </View>
                  <TouchableOpacity style={styles.hotspotMapClose} onPress={() => setActiveHotspotAddress(null)} activeOpacity={0.72}>
                    <Ionicons name="close" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <View style={styles.hotspotStatusRow}>
                  {activeHotspotStatusSummary.map((item) => (
                    <View key={item.key} style={styles.hotspotStatusPill}>
                      <View style={[styles.hotspotStatusDot, { backgroundColor: item.color }]} />
                      <Text style={styles.hotspotStatusLabel} numberOfLines={1}>{item.label}</Text>
                      <Text style={styles.hotspotStatusCount}>{item.count}</Text>
                    </View>
                  ))}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hotspotMapRequests}>
                  {activeHotspot.points.map((point) => (
                    <TouchableOpacity key={point.id} style={styles.hotspotMapRequest} onPress={() => setSelectedPoint(point)} activeOpacity={0.76}>
                      <View style={styles.hotspotMapRequestTop}>
                        <View style={[styles.hotspotMapCategoryMark, { backgroundColor: CATEGORY_COLORS[point.category] || '#9E9E9E' }]} />
                        <StatusBadge status={point.status as any} size="small" />
                      </View>
                      <Text style={styles.hotspotMapRequestTitle} numberOfLines={2}>{localizeProblemType(point.category, point.title, t)}</Text>
                      <View style={styles.hotspotMapRequestMeta}>
                        <Ionicons name="time-outline" size={13} color="#94A3B8" />
                        <Text style={styles.hotspotMapRequestDate}>{format(new Date(point.created_at), 'dd.MM HH:mm')}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
            {!activeHotspot ? (
              <View style={[styles.legend, isCompact && styles.legendCompact]}>
                {Object.entries(STATUS_COLORS).map(([key, color]) => (
                  <View key={key} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: color }]} />
                    <Text style={styles.legendText}>{t(`status.${key === 'in_progress' ? 'inProgress' : key}`)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
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
                {analyticsScopeLabel} · {t('map.analytics.requestsCount', { count: analytics.total })}
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
                {activeTimelineItem ? (
                  <View style={styles.timelineSummary}>
                    <Text style={styles.timelineSummaryMonth}>{activeTimelineItem.label}</Text>
                    <View style={styles.timelineSummaryStats}>
                      <View style={styles.timelineSummaryItem}>
                        <View style={styles.timelineSummaryItemHeader}>
                          <View style={[styles.analyticsLegendDot, styles.timelineSummaryDot, { backgroundColor: TIMELINE_COLORS.all }]} />
                          <Text style={styles.timelineSummaryLabel} numberOfLines={2}>{analyticsScopeLabel}</Text>
                        </View>
                        <Text style={styles.timelineSummaryValue}>{activeTimelineItem.all}</Text>
                      </View>
                      <View style={styles.timelineSummaryItem}>
                        <View style={styles.timelineSummaryItemHeader}>
                          <View style={[styles.analyticsLegendDot, styles.timelineSummaryDot, { backgroundColor: TIMELINE_COLORS.pending }]} />
                          <Text style={styles.timelineSummaryLabel} numberOfLines={2}>{t('status.pending')}</Text>
                        </View>
                        <Text style={styles.timelineSummaryValue}>{activeTimelineItem.pending}</Text>
                      </View>
                      <View style={styles.timelineSummaryItem}>
                        <View style={styles.timelineSummaryItemHeader}>
                          <View style={[styles.analyticsLegendDot, styles.timelineSummaryDot, { backgroundColor: TIMELINE_COLORS.closed }]} />
                          <Text style={styles.timelineSummaryLabel} numberOfLines={2}>{t('status.closed')}</Text>
                        </View>
                        <Text style={styles.timelineSummaryValue}>{activeTimelineItem.closed}</Text>
                      </View>
                    </View>
                  </View>
                ) : null}
                <View style={styles.timelineChart}>
                  {analytics.timeline.map((item) => {
                    const isActive = activeTimelineItem?.key === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[styles.timelineColumn, isActive && styles.timelineColumnActive]}
                        onPress={() => setSelectedTimelineMonth(item.key)}
                        activeOpacity={0.72}
                      >
                        <Text style={[styles.timelineCount, isActive && styles.timelineCountActive]}>{item.all}</Text>
                        <View style={styles.timelineBars}>
                          <View style={[styles.timelineBar, { height: Math.max((item.all / analytics.maxTimeline) * 76, item.all ? 8 : 2), backgroundColor: TIMELINE_COLORS.all }]} />
                          <View style={[styles.timelineBar, { height: Math.max((item.pending / analytics.maxTimeline) * 76, item.pending ? 8 : 2), backgroundColor: TIMELINE_COLORS.pending }]} />
                          <View style={[styles.timelineBar, { height: Math.max((item.closed / analytics.maxTimeline) * 76, item.closed ? 8 : 2), backgroundColor: TIMELINE_COLORS.closed }]} />
                        </View>
                        <Text style={styles.timelineLabel} numberOfLines={1}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.analyticsLegendRow}>
                  <View style={styles.analyticsLegendItem}><View style={[styles.analyticsLegendDot, { backgroundColor: TIMELINE_COLORS.all }]} /><Text style={styles.analyticsLegendText}>{analyticsScopeLabel}</Text></View>
                  <View style={styles.analyticsLegendItem}><View style={[styles.analyticsLegendDot, { backgroundColor: TIMELINE_COLORS.pending }]} /><Text style={styles.analyticsLegendText}>{t('status.pending')}</Text></View>
                  <View style={styles.analyticsLegendItem}><View style={[styles.analyticsLegendDot, { backgroundColor: TIMELINE_COLORS.closed }]} /><Text style={styles.analyticsLegendText}>{t('status.closed')}</Text></View>
                </View>
              </View>

              <View style={styles.analyticsCard}>
                <View style={styles.analyticsCardHeader}>
                  <Ionicons name="location-outline" size={18} color="#0F172A" />
                  <Text style={styles.analyticsCardTitle}>{t('map.analytics.hotspots')}</Text>
                </View>
                <View style={styles.hotspotList}>
                  {analytics.hotspots.map((item, index) => (
                    <TouchableOpacity key={`${item.address}-${index}`} style={styles.hotspotRow} activeOpacity={0.78} onPress={() => focusHotspot(item)}>
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

      <MapFilterSheet
        visible={isMapFiltersOpen}
        categoryOptions={categoryOptions}
        statusOptions={mapFilterStatusOptions}
        selectedCategory={categoryFilter}
        selectedStatus={statusFilter}
        selectedDateRange={dateRange}
        resultCount={filteredPoints.length}
        hasActiveFilters={hasMapFilters}
        bottomInset={insets.bottom}
        onClose={() => setIsMapFiltersOpen(false)}
        onApply={applyMapFilters}
        onReset={resetMapFilters}
      />

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
  legend: { position: 'absolute', left: 12, right: 12, top: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(255, 255, 255, 0.86)', borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.05)', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 4 },
  legendCompact: { gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: '#334155', fontWeight: '600' },
  mapFilterFab: { position: 'absolute', right: 14, bottom: 14, zIndex: 8, minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, borderRadius: 21, backgroundColor: 'rgba(255, 255, 255, 0.94)', borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.08)', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 6 },
  mapFilterFabActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  mapFilterFabText: { fontSize: 12, fontWeight: '900', color: '#475569' },
  mapFilterFabTextActive: { color: '#FFF' },
  mapFilterOverlay: { flex: 1, justifyContent: 'flex-end' },
  mapFilterBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.36)' },
  mapFilterSheet: { maxHeight: '84%', paddingHorizontal: 20, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FFF', shadowColor: '#0F172A', shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.16, shadowRadius: 28, elevation: 12 },
  mapFilterHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: '#CBD5E1', marginBottom: 16 },
  mapFilterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  mapFilterHeaderText: { flex: 1, minWidth: 0 },
  mapFilterTitle: { fontSize: 22, fontWeight: '900', color: '#111827' },
  mapFilterSubtitle: { marginTop: 2, fontSize: 13, fontWeight: '700', color: '#64748B' },
  mapFilterReset: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 999, backgroundColor: '#FFF4EC', borderWidth: 1, borderColor: 'rgba(255, 107, 0, 0.18)' },
  mapFilterResetDisabled: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
  mapFilterResetText: { fontSize: 13, fontWeight: '900', color: ORANGE },
  mapFilterResetTextDisabled: { color: '#94A3B8' },
  mapFilterScroll: { flexGrow: 0, marginTop: 8 },
  mapFilterScrollContent: { paddingBottom: 14 },
  mapFilterSection: { paddingVertical: 16, gap: 12 },
  mapFilterSectionTitle: { fontSize: 12, fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase' },
  mapFilterSeparator: { height: 1, backgroundColor: '#EEF2F7' },
  mapCategoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mapCategoryOption: { flexGrow: 1, flexBasis: '47%', minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  mapCategoryOptionWide: { flexBasis: '100%' },
  mapCategoryOptionActive: { backgroundColor: ORANGE, borderColor: ORANGE, shadowColor: ORANGE, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 3 },
  mapFilterOptionIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  mapFilterOptionIconActive: { backgroundColor: 'rgba(255, 255, 255, 0.18)' },
  mapCategoryOptionDot: { width: 11, height: 11, borderRadius: 5.5 },
  mapCategoryOptionText: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 17, fontWeight: '800', color: '#334155' },
  mapFilterOptionTextActive: { color: '#FFF' },
  mapStatusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mapStatusOption: { flexGrow: 1, flexBasis: '47%', minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  mapStatusOptionActive: { backgroundColor: '#FFF4EC', borderColor: ORANGE },
  mapStatusOptionDot: { width: 11, height: 11, borderRadius: 5.5 },
  mapStatusOptionText: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '800', color: '#475569' },
  mapStatusOptionTextActive: { color: ORANGE },
  mapStatusOptionCount: { minWidth: 24, fontSize: 14, fontWeight: '900', color: '#111827', textAlign: 'right' },
  mapStatusOptionCountActive: { color: '#111827' },
  mapFilterApply: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: ORANGE, shadowColor: ORANGE, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 4 },
  mapFilterApplyText: { fontSize: 16, fontWeight: '900', color: '#FFF' },
  calendarBox: { gap: 10, padding: 12, borderRadius: 20, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  calendarNav: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF', borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.08)', alignItems: 'center', justifyContent: 'center' },
  calendarNavDisabled: { opacity: 0.32 },
  calendarHeaderText: { flex: 1, minWidth: 0, alignItems: 'center' },
  calendarRangeLabel: { maxWidth: '100%', fontSize: 15, lineHeight: 19, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  calendarMonthLabel: { marginTop: 2, fontSize: 11, lineHeight: 14, fontWeight: '800', color: '#64748B', textTransform: 'capitalize' },
  calendarHelp: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: '#94A3B8', textAlign: 'center' },
  calendarWeekdays: { flexDirection: 'row', overflow: 'hidden', borderRadius: 12, backgroundColor: '#F1F5F9' },
  calendarWeekday: { flex: 1, paddingVertical: 8, fontSize: 10, lineHeight: 12, fontWeight: '900', color: '#64748B', textAlign: 'center', textTransform: 'uppercase' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDay: { width: '14.2857%', minWidth: 0, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  calendarDayMuted: { opacity: 0.48 },
  calendarDayInRange: { borderRadius: 5, backgroundColor: 'rgba(14, 165, 233, 0.12)' },
  calendarDaySelected: { backgroundColor: ORANGE, shadowColor: ORANGE, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 3 },
  calendarDayAnchor: { borderWidth: 2, borderColor: 'rgba(255, 107, 0, 0.28)' },
  calendarDayDisabled: { opacity: 0.22 },
  calendarDayText: { fontSize: 13, fontWeight: '900', color: '#475569' },
  calendarDayTextMuted: { color: '#94A3B8' },
  calendarDayTextInRange: { color: '#334155' },
  calendarDayTextSelected: { color: '#FFF' },
  hotspotMapCallout: { position: 'absolute', top: 12, left: 12, right: 12, padding: 14, borderRadius: 24, backgroundColor: 'rgba(255, 255, 255, 0.96)', borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.08)', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.14, shadowRadius: 26, elevation: 8 },
  hotspotMapHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hotspotMapPin: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#FFF4EC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 107, 0, 0.16)' },
  hotspotMapTitleWrap: { flex: 1, minWidth: 0 },
  hotspotMapTitle: { fontSize: 17, lineHeight: 21, fontWeight: '900', color: '#111827' },
  hotspotMapSubtitle: { marginTop: 2, fontSize: 12, fontWeight: '800', color: '#64748B' },
  hotspotMapClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  hotspotStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  hotspotStatusPill: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.05)' },
  hotspotStatusDot: { width: 8, height: 8, borderRadius: 4 },
  hotspotStatusLabel: { maxWidth: 92, fontSize: 11, fontWeight: '800', color: '#64748B' },
  hotspotStatusCount: { fontSize: 12, fontWeight: '900', color: '#111827' },
  hotspotMapRequests: { gap: 10, paddingTop: 12, paddingRight: 2 },
  hotspotMapRequest: { width: 214, minHeight: 96, alignItems: 'stretch', justifyContent: 'space-between', gap: 8, padding: 12, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.06)' },
  hotspotMapRequestTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hotspotMapCategoryMark: { width: 10, height: 10, borderRadius: 5 },
  hotspotMapRequestTitle: { minHeight: 34, fontSize: 13, lineHeight: 17, fontWeight: '900', color: '#1E293B' },
  hotspotMapRequestMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hotspotMapRequestDate: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
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
  timelineSummary: { marginBottom: 14, padding: 12, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.06)', gap: 10 },
  timelineSummaryMonth: { fontSize: 13, fontWeight: '900', color: '#111827', textTransform: 'uppercase' },
  timelineSummaryStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timelineSummaryItem: { flexGrow: 1, flexBasis: '30%', minWidth: 92, alignItems: 'stretch', justifyContent: 'space-between', gap: 8, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFF' },
  timelineSummaryItemHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  timelineSummaryDot: { marginTop: 3 },
  timelineSummaryLabel: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 14, fontWeight: '700', color: '#64748B' },
  timelineSummaryValue: { alignSelf: 'flex-end', minWidth: 44, fontSize: 20, lineHeight: 24, fontWeight: '900', color: '#111827', textAlign: 'right' },
  timelineChart: { minHeight: 124, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 },
  timelineColumn: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6, paddingHorizontal: 2, paddingVertical: 6, borderRadius: 12 },
  timelineColumnActive: { backgroundColor: '#F8FAFC' },
  timelineCount: { minHeight: 12, fontSize: 9, color: '#94A3B8', fontWeight: '800' },
  timelineCountActive: { color: '#111827' },
  timelineBars: { height: 78, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2 },
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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { NewsFilterSheet, type PeriodFilter, type SortFilter } from '../../src/components/NewsFilterSheet';
import { NewsCard } from '../../src/components/NewsCard';
import { AIAssistantHeaderButton } from '../../src/components/AIAssistantWidget';
import { useAuth } from '../../src/context/AuthContext';
import { apiService, type NewsItem } from '../../src/utils/api';
import {
  categoryKeyMap,
  getBorderColor,
  getNewsCategory,
  getNewsLocation,
  getNewsPeriod,
  getNewsTypeMeta,
  getNewsTypes,
  NEWS_CATEGORY_COLOR,
  typeKeyMap,
} from '../../src/utils/newsMeta';

const ALL_FILTER = '__all__';
const ORANGE = '#FB8C00';
const LIMIT = 20;

function normalizeLanguage(language?: string) {
  if (!language) {
    return 'ru';
  }

  if (language.startsWith('kz') || language.startsWith('kk')) {
    return 'kz';
  }

  if (language.startsWith('ru')) {
    return 'ru';
  }

  return 'en';
}

function getLocalizedText(item: NewsItem, field: 'title' | 'content', language: string) {
  const normalized = normalizeLanguage(language);
  const localizedField = normalized === 'en' ? `${field}_en` : `${field}_${normalized}`;
  return String((item as Record<string, unknown>)[localizedField] ?? item[field] ?? '');
}

function formatDetailPeriod(start?: string, end?: string) {
  if (!start) {
    return '';
  }

  const startDate = new Date(start.endsWith('Z') ? start : `${start}Z`);
  const endDate = end ? new Date(end.endsWith('Z') ? end : `${end}Z`) : null;
  if (Number.isNaN(startDate.getTime())) {
    return '';
  }

  const formatUtcDate = (value: Date) => {
    const day = String(value.getUTCDate()).padStart(2, '0');
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const year = value.getUTCFullYear();
    const hours = String(value.getUTCHours()).padStart(2, '0');
    const minutes = String(value.getUTCMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  const startLabel = formatUtcDate(startDate);
  if (!endDate || Number.isNaN(endDate.getTime())) {
    return startLabel;
  }

  return `${startLabel} - ${formatUtcDate(endDate)}`;
}

function formatNewsCreatedLabel(value: string, t: (key: string, options?: Record<string, unknown>) => string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return t('news.createdJustNow');
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 60) {
    return t('news.createdJustNow');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return t('news.createdHoursAgo', { count: diffHours });
  }

  const diffDays = Math.round(diffHours / 24);
  return t('news.createdAgo', { count: diffDays });
}

const SearchBar = React.memo(function SearchBar({
  value,
  onChangeText,
  onPressFilter,
  hasActiveFilters,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onPressFilter: () => void;
  hasActiveFilters: boolean;
  placeholder: string;
}) {
  return (
    <View style={styles.searchWrap}>
      <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
      />
      <TouchableOpacity style={styles.filterButton} onPress={onPressFilter} activeOpacity={0.85}>
        <MaterialCommunityIcons name="tune-variant" size={21} color="#475569" />
        {hasActiveFilters ? <View style={styles.filterBadge} /> : null}
      </TouchableOpacity>
    </View>
  );
});

export default function NewsScreen() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_FILTER);
  const [selectedType, setSelectedType] = useState<string>(ALL_FILTER);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('all');
  const [sort, setSort] = useState<SortFilter>('date_desc');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const currentLanguage = normalizeLanguage(user?.language || i18n.language || 'ru');
  const t = useMemo(() => i18n.getFixedT(currentLanguage), [currentLanguage, i18n]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchNews = useCallback(async (refresh = false) => {
    if (!refresh) {
      setIsFetching(true);
    }

    try {
      const response = await apiService.getNews({
        search: search || undefined,
        category: selectedCategory !== ALL_FILTER ? selectedCategory : undefined,
        type: selectedType !== ALL_FILTER ? selectedType : undefined,
        period: selectedPeriod !== 'all' ? selectedPeriod : undefined,
        sort,
        page,
        limit: LIMIT,
      });
      setNews(response.data.news);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsFetching(false);
    }
  }, [page, search, selectedCategory, selectedPeriod, selectedType, sort]);

  useEffect(() => {
    void fetchNews();
  }, [fetchNews]);

  const pageCount = Math.max(1, Math.ceil(total / LIMIT));
  const hasActiveFilters = selectedCategory !== ALL_FILTER
    || selectedType !== ALL_FILTER
    || selectedPeriod !== 'all'
    || sort !== 'date_desc';

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchNews(true);
  }, [fetchNews]);

  const renderDetailModal = () => {
    if (!selectedNews) {
      return null;
    }

    const types = getNewsTypes(selectedNews);
    const category = getNewsCategory(selectedNews);
    const location = getNewsLocation(selectedNews);
    const period = getNewsPeriod(selectedNews);
    const accentColor = getBorderColor(period.start, period.end);
    const title = getLocalizedText(selectedNews, 'title', currentLanguage);
    const content = getLocalizedText(selectedNews, 'content', currentLanguage);
    const periodLabel = formatDetailPeriod(period.start, period.end);

    return (
      <Modal
        visible
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={() => setSelectedNews(null)}
      >
        <View style={styles.modalScreen}>
          <View style={[styles.modalColorBand, { backgroundColor: accentColor }]} />
          <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
            <View style={styles.modalIconsRow}>
              {types.map((type, index) => {
                const meta = getNewsTypeMeta(type);
                return (
                  <View
                    key={`${selectedNews.id}-modal-icon-${type}-${index}`}
                    style={[styles.modalIconWrap, { backgroundColor: meta.color }]}
                  >
                    <MaterialCommunityIcons name={meta.icon} size={26} color="#FFFFFF" />
                  </View>
                );
              })}
            </View>
            <TouchableOpacity
              onPress={() => setSelectedNews(null)}
              style={styles.closeButton}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={[styles.modalContent, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.modalTitle}>{title}</Text>

            <View style={styles.modalMetaRow}>
              <View style={styles.modalTimeRow}>
                <MaterialCommunityIcons name="clock-outline" size={15} color="#6B7280" />
                <Text style={styles.modalMetaText}>
                  {formatNewsCreatedLabel(selectedNews.created_at, t)}
                </Text>
              </View>
              <View style={styles.modalCategoryChip}>
                <Text style={styles.modalCategoryChipText}>
                  {t(categoryKeyMap[category] ?? category)}
                </Text>
              </View>
            </View>

            <View style={styles.modalTypesRow}>
              {types.map((type) => {
                const meta = getNewsTypeMeta(type);
                return (
                  <View
                    key={`${selectedNews.id}-${type}`}
                    style={[styles.modalTypeChip, { backgroundColor: `${meta.color}14` }]}
                  >
                    <MaterialCommunityIcons name={meta.icon} size={15} color={meta.color} />
                    <Text style={[styles.modalTypeChipText, { color: meta.color }]}>
                      {t(typeKeyMap[type] ?? type)}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Text style={styles.modalBodyText}>{content}</Text>

            {periodLabel ? (
              <View style={styles.detailInfoCard}>
                <Text style={styles.detailInfoLabel}>{t('news.period')}</Text>
                <Text style={styles.detailInfoValue}>{periodLabel}</Text>
              </View>
            ) : null}

            {location ? (
              <View style={styles.detailInfoCard}>
                <Text style={styles.detailInfoLabel}>{t('news.location')}</Text>
                <Text style={styles.detailInfoValue}>{location}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
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
      <View style={styles.headerBlock}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle}>{t('news.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('news.subtitle')}</Text>
          </View>
          <AIAssistantHeaderButton />
        </View>
        <SearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          onPressFilter={() => setFilterSheetOpen(true)}
          hasActiveFilters={hasActiveFilters}
          placeholder={t('news.searchPlaceholder')}
        />
      </View>

      <FlatList
        data={news}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NewsCard news={item} onPress={() => setSelectedNews(item)} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={ORANGE} />
        }
        ListFooterComponent={
          <View style={styles.footerSpace}>
            {isFetching ? <ActivityIndicator size="small" color={ORANGE} /> : null}
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.paginationButton, page <= 1 && styles.paginationButtonDisabled]}
                disabled={page <= 1}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
              >
                <Text style={styles.paginationButtonText}>{t('common.back')}</Text>
              </TouchableOpacity>
              <Text style={styles.paginationText}>{page} / {pageCount}</Text>
              <TouchableOpacity
                style={[styles.paginationButton, page >= pageCount && styles.paginationButtonDisabled]}
                disabled={page >= pageCount}
                onPress={() => setPage((current) => Math.min(pageCount, current + 1))}
              >
                <Text style={styles.paginationButtonText}>{t('common.continue')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="newspaper-variant-outline" size={52} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>{t('news.noNews')}</Text>
            <Text style={styles.emptyText}>{t('news.emptyFiltered')}</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <NewsFilterSheet
        visible={filterSheetOpen}
        selectedCategory={selectedCategory}
        selectedType={selectedType}
        selectedPeriod={selectedPeriod}
        selectedSort={sort}
        categoryAllLabel={t('news.allCategories')}
        typeAllLabel={t('news.allTypes')}
        onClose={() => setFilterSheetOpen(false)}
        onReset={() => {
          setPage(1);
          setSelectedCategory(ALL_FILTER);
          setSelectedType(ALL_FILTER);
          setSelectedPeriod('all');
          setSort('date_desc');
        }}
        onApply={({ category, type, period, sort: nextSort }) => {
          setPage(1);
          setSelectedCategory(category);
          setSelectedType(type);
          setSelectedPeriod(period);
          setSort(nextSort);
        }}
      />

      {renderDetailModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  headerBlock: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
  },
  headerTextBlock: {
    flex: 1,
    gap: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerTitle: {
    fontSize: 30,
    lineHeight: 34,
    color: '#111827',
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: '#475569',
    fontWeight: '500',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  filterBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: ORANGE,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 64,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 17,
    color: '#111827',
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  footerSpace: {
    gap: 16,
    paddingTop: 16,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  paginationButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationButtonDisabled: {
    opacity: 0.45,
  },
  paginationButtonText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  paginationText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
  modalScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalColorBand: {
    height: 10,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  modalIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    paddingRight: 12,
  },
  modalIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    paddingHorizontal: 20,
    gap: 18,
  },
  modalTitle: {
    fontSize: 28,
    lineHeight: 34,
    color: '#111827',
    fontWeight: '800',
  },
  modalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  modalTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalMetaText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalCategoryChip: {
    backgroundColor: NEWS_CATEGORY_COLOR,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  modalCategoryChipText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalTypesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalTypeChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalBodyText: {
    fontSize: 16,
    lineHeight: 25,
    color: '#334155',
    fontWeight: '500',
  },
  detailInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  detailInfoLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailInfoValue: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1F2937',
    fontWeight: '600',
  },
});

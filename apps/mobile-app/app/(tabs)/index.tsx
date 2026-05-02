import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { NewsCard } from '../../src/components/NewsCard';
import { useAuth } from '../../src/context/AuthContext';
import { apiService, NewsItem } from '../../src/utils/api';
import {
  formatNewsRelativeTime,
  getNewsCategory,
  getNewsLocation,
  getNewsPeriod,
  getNewsTypeMeta,
  getNewsTypes,
  NEWS_CATEGORY_COLOR,
  NEWS_CATEGORY_OPTIONS,
} from '../../src/utils/newsMeta';

const ALL_CATEGORY = 'Все';
const ORANGE = '#FB8C00';

function getLocalizedText(item: NewsItem, field: 'title' | 'content', language: string) {
  const normalized = language.startsWith('kz') || language.startsWith('kk')
    ? 'kz'
    : language.startsWith('ru')
      ? 'ru'
      : 'en';
  const localizedField = normalized === 'en' ? field : `${field}_${normalized}`;
  return String((item as Record<string, unknown>)[localizedField] ?? item[field] ?? '');
}

function formatDetailPeriod(start?: string, end?: string) {
  if (!start) {
    return '';
  }

  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  if (Number.isNaN(startDate.getTime())) {
    return '';
  }

  const startLabel = format(startDate, 'dd.MM.yyyy HH:mm');
  if (!endDate || Number.isNaN(endDate.getTime())) {
    return startLabel;
  }

  return `${startLabel} - ${format(endDate, 'dd.MM.yyyy HH:mm')}`;
}

export default function NewsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const currentLanguage = user?.language || i18n.language || 'ru';

  const fetchNews = useCallback(async () => {
    try {
      const response = await apiService.getNews();
      setNews(response.data);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const categories = useMemo(() => [ALL_CATEGORY, ...NEWS_CATEGORY_OPTIONS], []);

  const filteredNews = useMemo(() => {
    if (selectedCategory === ALL_CATEGORY) {
      return news;
    }

    return news.filter((item) => getNewsCategory(item) === selectedCategory);
  }, [news, selectedCategory]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchNews();
  }, [fetchNews]);

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      <Text style={styles.headerTitle}>{t('news.title')}</Text>
      <Text style={styles.headerSubtitle}>{t('news.subtitle')}</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {categories.map((category) => {
          const active = category === selectedCategory;
          return (
            <TouchableOpacity
              key={category}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setSelectedCategory(category)}
              activeOpacity={0.9}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {category}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderDetailModal = () => {
    if (!selectedNews) {
      return null;
    }

    const types = getNewsTypes(selectedNews);
    const primaryType = types[0];
    const primaryMeta = getNewsTypeMeta(primaryType);
    const category = getNewsCategory(selectedNews);
    const location = getNewsLocation(selectedNews);
    const period = getNewsPeriod(selectedNews);
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
          <View style={[styles.modalColorBand, { backgroundColor: primaryMeta.color }]} />
          <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: primaryMeta.color }]}>
              <MaterialCommunityIcons name={primaryMeta.icon} size={26} color="#FFFFFF" />
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
                <Text style={styles.modalMetaText}>{formatNewsRelativeTime(selectedNews.created_at)}</Text>
              </View>
              <View style={styles.modalCategoryChip}>
                <Text style={styles.modalCategoryChipText}>{category}</Text>
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
                    <Text style={[styles.modalTypeChipText, { color: meta.color }]}>{type}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={styles.modalBodyText}>{content}</Text>

            {periodLabel ? (
              <View style={styles.detailInfoCard}>
                <Text style={styles.detailInfoLabel}>Период</Text>
                <Text style={styles.detailInfoValue}>{periodLabel}</Text>
              </View>
            ) : null}

            {location ? (
              <View style={styles.detailInfoCard}>
                <Text style={styles.detailInfoLabel}>Локация</Text>
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
      <FlatList
        data={filteredNews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NewsCard news={item} onPress={() => setSelectedNews(item)} />}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={ORANGE} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="newspaper-variant-outline" size={52} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Новостей пока нет</Text>
            <Text style={styles.emptyText}>Попробуйте выбрать другую категорию или обновить список.</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
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
    paddingTop: 8,
  },
  headerBlock: {
    gap: 14,
    paddingBottom: 18,
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
  filtersRow: {
    gap: 10,
    paddingRight: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: ORANGE,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  filterChipActive: {
    backgroundColor: ORANGE,
  },
  filterChipText: {
    fontSize: 13,
    color: ORANGE,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
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

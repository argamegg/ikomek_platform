import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  NewsForm,
  createInitialNewsFormValue,
  type NewsFormSubmitOptions,
  type NewsFormValues,
} from '../../src/components/NewsForm';
import { NewsFilterSheet, type PeriodFilter, type SortFilter } from '../../src/components/NewsFilterSheet';
import { apiService, type NewsItem } from '../../src/utils/api';
import {
  categoryKeyMap,
  getBorderColor,
  getNewsCategory,
  getNewsPeriod,
  getNewsTypeMeta,
  getNewsTypes,
  NEWS_CATEGORY_COLOR,
  typeKeyMap,
} from '../../src/utils/newsMeta';

const ORANGE = '#FB8C00';
const ALL_FILTER = '__all__';
const LIMIT = 20;

function toFormValue(item?: NewsItem | null): NewsFormValues {
  if (!item) {
    return createInitialNewsFormValue();
  }

  return {
    title: item.title || '',
    title_ru: item.title_ru || '',
    title_kz: item.title_kz || '',
    title_en: item.title_en || '',
    content: item.content || '',
    content_ru: item.content_ru || '',
    content_kz: item.content_kz || '',
    content_en: item.content_en || '',
    summary: item.summary || '',
    summary_ru: item.summary_ru || '',
    summary_kz: item.summary_kz || '',
    summary_en: item.summary_en || '',
    category: getNewsCategory(item),
    types: getNewsTypes(item),
    location: item.location || '',
    start_at: item.start_at || item.period_start || '',
    end_at: item.end_at || item.period_end || '',
    source_lang: item.source_lang === 'en' ? 'en' : item.source_lang === 'kk' ? 'kk' : 'ru',
    translation_status: item.translation_status,
  };
}

function getTranslationStatusMeta(status?: string) {
  if (status === 'translated') {
    return {
      icon: 'check-circle',
      color: '#43A047',
      backgroundColor: '#E8F5E9',
      key: 'translated',
    };
  }

  if (status === 'failed') {
    return {
      icon: 'alert-circle',
      color: '#F9A825',
      backgroundColor: '#FFF8E1',
      key: 'failed',
    };
  }

  if (status === 'skipped') {
    return {
      icon: 'close-circle-outline',
      color: '#9E9E9E',
      backgroundColor: '#F5F5F5',
      key: 'skipped',
    };
  }

  return null;
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

export default function NewsManageScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_FILTER);
  const [selectedType, setSelectedType] = useState<string>(ALL_FILTER);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('all');
  const [sort, setSort] = useState<SortFilter>('date_desc');

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
      console.error('Failed to load news', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsFetching(false);
    }
  }, [page, search, selectedCategory, selectedPeriod, selectedType, sort]);

  useEffect(() => {
    void fetchNews();
  }, [fetchNews]);

  const articleCountLabel = useMemo(
    () => t('admin.articlesCount', { count: total }),
    [t, total],
  );
  const pageCount = Math.max(1, Math.ceil(total / LIMIT));
  const currentFormValue = useMemo(() => toFormValue(editingNews), [editingNews]);
  const hasActiveFilters = selectedCategory !== ALL_FILTER
    || selectedType !== ALL_FILTER
    || selectedPeriod !== 'all'
    || sort !== 'date_desc';

  const resetModal = () => {
    setEditingNews(null);
    setModalOpen(false);
  };

  const validateForm = (value: NewsFormValues) => {
    if (!value.title.trim() || !value.content.trim()) {
      Alert.alert(t('common.error'), t('admin.news.fillTitleAndText'));
      return false;
    }

    if (value.types.length === 0) {
      Alert.alert(t('common.error'), t('admin.news.selectOneType'));
      return false;
    }

    return true;
  };

  const handleTranslate = async (value: NewsFormValues) => {
    if (!validateForm(value)) {
      throw new Error('invalid-form');
    }

    setIsTranslating(true);
    try {
      const response = await apiService.previewNewsTranslation({
        title: value.title,
        content: value.content,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to preview translation', error);
      Alert.alert(t('common.error'), t('admin.news.translationFailed'));
      throw error;
    } finally {
      setIsTranslating(false);
    }
  };

  const buildPayload = (value: NewsFormValues, options?: NewsFormSubmitOptions) => ({
    title: value.title,
    title_ru: value.title_ru || undefined,
    title_kz: value.title_kz || undefined,
    title_en: value.title_en || undefined,
    content: value.content,
    content_ru: value.content_ru || undefined,
    content_kz: value.content_kz || undefined,
    content_en: value.content_en || undefined,
    summary: value.summary || value.content.slice(0, 180),
    summary_ru: value.summary_ru || undefined,
    summary_kz: value.summary_kz || undefined,
    summary_en: value.summary_en || undefined,
    category: value.category,
    types: value.types,
    location: value.location || undefined,
    start_at: value.start_at || undefined,
    end_at: value.end_at || undefined,
    source_lang: value.source_lang,
    translation_status: value.translation_status,
    skip_translation: options?.skipTranslation ?? false,
  });

  const handleSubmit = async (value: NewsFormValues, options: NewsFormSubmitOptions) => {
    if (!validateForm(value)) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingNews) {
        await apiService.updateNews(editingNews.id, buildPayload(value, options));
        Alert.alert(t('common.success'), t('admin.news.updated'));
      } else {
        await apiService.createNews(buildPayload(value, options));
        Alert.alert(t('common.success'), t('admin.news.published'));
      }

      resetModal();
      await fetchNews();
    } catch (error) {
      console.error('Failed to save news', error);
      Alert.alert(t('common.error'), t('admin.news.publishFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(t('admin.news.deleteTitle'), t('admin.news.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteNews(id);
            await fetchNews();
          } catch (error) {
            console.error('Failed to delete news', error);
            Alert.alert(t('common.error'), t('admin.news.deleteFailed'));
          }
        },
      },
    ]);
  };

  const renderCard = ({ item }: { item: NewsItem }) => {
    const types = getNewsTypes(item);
    const primaryType = types[0];
    const primaryMeta = getNewsTypeMeta(primaryType);
    const category = getNewsCategory(item);
    const period = getNewsPeriod(item);
    const borderColor = getBorderColor(period.start, period.end);
    const statusMeta = getTranslationStatusMeta(item.translation_status);
    const periodLabel = period.start
      ? `${format(new Date(period.start), 'dd.MM HH:mm')}${period.end ? ` - ${format(new Date(period.end), 'dd.MM HH:mm')}` : ''}`
      : '';

    return (
      <View style={styles.newsCard}>
        <View style={[styles.newsStrip, { backgroundColor: borderColor }]} />
        <View style={styles.newsBody}>
          <View style={styles.newsTop}>
            <View style={styles.newsTopLeft}>
              <View style={[styles.newsTypePill, { backgroundColor: `${primaryMeta.color}14` }]}>
                <MaterialCommunityIcons name={primaryMeta.icon} size={14} color={primaryMeta.color} />
                <Text style={[styles.newsTypeText, { color: primaryMeta.color }]}>
                  {t(typeKeyMap[primaryType] ?? primaryType)}
                </Text>
              </View>
              {statusMeta ? (
                <View style={[styles.translationBadge, { backgroundColor: statusMeta.backgroundColor }]}>
                  <MaterialCommunityIcons name={statusMeta.icon} size={15} color={statusMeta.color} style={styles.translationIcon} />
                  <Text style={[styles.translationBadgeText, { color: statusMeta.color }]}>
                    {t(`news.translationStatus.${statusMeta.key}`)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.newsDate}>{format(new Date(item.created_at), 'dd.MM.yy')}</Text>
          </View>

          <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.newsContent} numberOfLines={3}>{item.summary || item.content}</Text>

          {types.length > 1 ? (
            <View style={styles.extraTypesRow}>
              {types.slice(1).map((type) => {
                const meta = getNewsTypeMeta(type);
                return (
                  <View key={`${item.id}-${type}`} style={styles.extraTypeItem}>
                    <View style={[styles.extraTypeDot, { backgroundColor: meta.color }]} />
                    <Text style={styles.extraTypeText}>{t(typeKeyMap[type] ?? type)}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.newsMetaRow}>
            <View style={styles.newsMetaItem}>
              <MaterialCommunityIcons name="clock-outline" size={13} color="#7C8798" />
              <Text style={styles.newsMetaText} numberOfLines={1}>
                {periodLabel || format(new Date(item.created_at), 'dd.MM.yyyy')}
              </Text>
            </View>
            <View style={styles.newsCategoryChip}>
              <Text style={styles.newsCategoryChipText}>{t(categoryKeyMap[category] ?? category)}</Text>
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => {
                setEditingNews(item);
                setModalOpen(true);
              }}
            >
              <MaterialCommunityIcons name="pencil-outline" size={16} color={ORANGE} />
              <Text style={styles.editText}>{t('common.edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
              <MaterialCommunityIcons name="trash-can-outline" size={16} color="#E53935" />
              <Text style={styles.deleteText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
      <View style={styles.headerContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{t('admin.news.title')}</Text>
            <Text style={styles.headerSub}>{articleCountLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              setEditingNews(null);
              setModalOpen(true);
            }}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <SearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          onPressFilter={() => setFilterSheetOpen(true)}
          hasActiveFilters={hasActiveFilters}
          placeholder={t('admin.news.searchPlaceholder')}
        />
      </View>

      <FlatList
        data={news}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              void fetchNews(true);
            }}
            tintColor={ORANGE}
          />
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
            <Text style={styles.emptyText}>{t('admin.news.emptyFiltered')}</Text>
          </View>
        }
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        showsVerticalScrollIndicator={false}
      />

      <NewsFilterSheet
        visible={filterSheetOpen}
        selectedCategory={selectedCategory}
        selectedType={selectedType}
        selectedPeriod={selectedPeriod}
        selectedSort={sort}
        categoryAllLabel={t('admin.news.allCategories')}
        typeAllLabel={t('admin.news.allTypes')}
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

      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { paddingTop: insets.top || 16 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={resetModal}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingNews ? t('admin.news.editArticleTitle') : t('admin.news.newArticle')}
            </Text>
            <View style={{ width: 58 }} />
          </View>

          <NewsForm
            initialValue={currentFormValue}
            submitLabel={editingNews ? t('common.save') : t('admin.news.publish')}
            isSubmitting={isSubmitting}
            isTranslating={isTranslating}
            onCancel={resetModal}
            onSubmit={handleSubmit}
            onTranslate={handleTranslate}
          />
        </View>
      </Modal>
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
  headerContent: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  headerSub: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
    marginTop: 4,
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FB8C00',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 5,
  },
  list: {
    paddingHorizontal: 16,
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
  newsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  newsStrip: {
    width: 5,
  },
  newsBody: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  newsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  newsTopLeft: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    gap: 8,
  },
  newsTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  newsTypeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  newsDate: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  translationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  translationIcon: {
    marginRight: 0,
  },
  translationBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  newsCategoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: NEWS_CATEGORY_COLOR,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  newsCategoryChipText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  newsTitle: {
    fontSize: 17,
    lineHeight: 22,
    color: '#111827',
    fontWeight: '800',
  },
  newsContent: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
    fontWeight: '500',
  },
  newsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  newsMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  newsMetaText: {
    fontSize: 12,
    color: '#7C8798',
    fontWeight: '600',
  },
  extraTypesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  extraTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
  },
  extraTypeDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  extraTypeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  editText: {
    fontSize: 13,
    color: ORANGE,
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  deleteText: {
    fontSize: 13,
    color: '#E53935',
    fontWeight: '600',
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
    paddingBottom: 8,
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  cancelText: {
    fontSize: 17,
    color: '#64748B',
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 17,
    color: '#111827',
    fontWeight: '700',
  },
});

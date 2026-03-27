import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { apiService, NewsItem } from '../../src/utils/api';
import { useAuth } from '../../src/context/AuthContext';

const ORANGE = '#FF6B00';

const CATEGORY_CONFIG = {
  critical: {
    icon: 'alert-circle' as const,
    color: '#FF3B30',
    bgColor: 'rgba(255, 59, 48, 0.1)'
  },
  warning: {
    icon: 'warning' as const,
    color: '#FF9500',
    bgColor: 'rgba(255, 149, 0, 0.1)'
  },
  info: {
    icon: 'information-circle' as const,
    color: '#007AFF',
    bgColor: 'rgba(0, 122, 255, 0.1)'
  }
};

export default function NewsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  
  const insets = useSafeAreaInsets();
  const currentLang = user?.language || i18n.language || 'ru';

  const fetchNews = useCallback(async () => {
    try {
      const response = await apiService.getNews(filter || undefined);
      setNews(response.data);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchNews();
  };

  const getLocalizedText = (item: NewsItem, field: 'title' | 'content') => {
    const langSuffix = currentLang === 'en' ? '' : `_${currentLang}`;
    const localizedField = langSuffix ? `${field}${langSuffix}` : field;
    return (item as any)[localizedField] || item[field];
  };

  const filters = [
    { key: null, label: t('common.all'), icon: 'list' },
    { key: 'critical', label: t('news.critical'), icon: 'alert-circle', color: '#FF3B30' },
    { key: 'warning', label: t('news.warning'), icon: 'warning', color: '#FF9500' },
    { key: 'info', label: t('news.info'), icon: 'information-circle', color: '#007AFF' }
  ];

  const renderNewsCard = ({ item }: { item: NewsItem }) => {
    const config = CATEGORY_CONFIG[item.category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.info;
    const title = getLocalizedText(item, 'title');
    const content = getLocalizedText(item, 'content');

    return (
      <TouchableOpacity 
        style={styles.newsCard} 
        onPress={() => setSelectedNews(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.indicator, { backgroundColor: config.color }]} />
        <View style={styles.newsContent}>
          <View style={styles.newsHeader}>
            <View style={[styles.badge, { backgroundColor: config.bgColor }]}>
              <Ionicons name={config.icon} size={14} color={config.color} />
              <Text style={[styles.badgeText, { color: config.color }]}>
                {t(`news.${item.category}`)}
              </Text>
            </View>
            <Text style={styles.newsDate}>
              {format(new Date(item.created_at), 'dd.MM.yyyy')}
            </Text>
          </View>
          <Text style={styles.newsTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.newsPreview} numberOfLines={2}>{content}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" style={styles.chevron} />
      </TouchableOpacity>
    );
  };

  const renderNewsDetail = () => {
    if (!selectedNews) return null;
    
    const config = CATEGORY_CONFIG[selectedNews.category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.info;
    const title = getLocalizedText(selectedNews, 'title');
    const content = getLocalizedText(selectedNews, 'content');

    return (
      <Modal visible={!!selectedNews} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedNews(null)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#1C1C1E" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('news.title')}</Text>
            <View style={{ width: 44 }} />
          </View>
          
          <View style={styles.modalContent}>
            <View style={[styles.categoryBadge, { backgroundColor: `${config.color}15` }]}>
              <Ionicons name={config.icon} size={16} color={config.color} />
              <Text style={[styles.categoryText, { color: config.color }]}>
                {t(`news.${selectedNews.category}`)}
              </Text>
            </View>
            
            <Text style={styles.detailTitle}>{title}</Text>
            <Text style={styles.detailDate}>
              {format(new Date(selectedNews.created_at), 'dd MMMM yyyy, HH:mm')}
            </Text>
            
            <View style={styles.divider} />
            
            <Text style={styles.detailContent}>{content}</Text>
          </View>
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('news.title')}</Text>
        <Text style={styles.headerSubtitle}>{t('news.subtitle')}</Text>
      </View>

      <View style={styles.filterContainer}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key || 'all'}
            style={[styles.filterButton, filter === f.key && styles.filterButtonActive]}
            onPress={() => setFilter(f.key)}
          >
            <Ionicons
              name={f.icon as any}
              size={16}
              color={filter === f.key ? '#FFF' : (f.color || '#8E8E93')}
            />
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={news}
        keyExtractor={(item) => item.id}
        renderItem={renderNewsCard}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={ORANGE} />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="newspaper-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyText}>{t('news.noNews')}</Text>
          </View>
        }
      />

      {renderNewsDetail()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7'
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    padding: 20,
    paddingBottom: 12
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E'
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
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
    gap: 4
  },
  filterButtonActive: {
    backgroundColor: ORANGE
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
    paddingTop: 4,
    paddingHorizontal: 16
  },
  newsCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden'
  },
  indicator: {
    width: 4,
    height: '100%',
    position: 'absolute',
    left: 0
  },
  newsContent: {
    flex: 1,
    padding: 16,
    paddingLeft: 20
  },
  newsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600'
  },
  newsDate: {
    fontSize: 12,
    color: '#8E8E93'
  },
  newsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4
  },
  newsPreview: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18
  },
  chevron: {
    marginRight: 12
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12
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
    paddingVertical: 12,
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
    padding: 20
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
    gap: 6
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600'
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8
  },
  detailDate: {
    fontSize: 14,
    color: '#8E8E93'
  },
  divider: {
    height: 1,
    backgroundColor: '#F2F2F7',
    marginVertical: 20
  },
  detailContent: {
    fontSize: 16,
    color: '#3C3C43',
    lineHeight: 24
  }
});

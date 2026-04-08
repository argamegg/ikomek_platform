import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { NewsItem } from '../utils/api';

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

interface NewsCardProps {
  news: NewsItem;
  onPress: () => void;
}

export const NewsCard = ({ news, onPress }: NewsCardProps) => {
  const { t } = useTranslation();
  const config = CATEGORY_CONFIG[news.category] || CATEGORY_CONFIG.info;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.indicator, { backgroundColor: config.color }]} />
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: config.bgColor }]}>
            <Ionicons name={config.icon} size={14} color={config.color} />
            <Text style={[styles.badgeText, { color: config.color }]}>{t(`news.${news.category}`)}</Text>
          </View>
          <Text style={styles.date}>
            {format(new Date(news.created_at), 'dd.MM.yyyy')}
          </Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{news.title}</Text>
        <Text style={styles.preview} numberOfLines={2}>{news.content}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3
  },
  indicator: {
    width: 4,
    height: '100%',
    position: 'absolute',
    left: 0
  },
  content: {
    flex: 1,
    padding: 16,
    paddingLeft: 20
  },
  header: {
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
  date: {
    fontSize: 12,
    color: '#8E8E93'
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4
  },
  preview: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18
  }
});

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { NewsItem } from '../utils/api';
import {
  getNewsCategory,
  getNewsLocation,
  getNewsPeriod,
  getNewsTypeMeta,
  getNewsTypes,
  NEWS_CATEGORY_COLOR,
} from '../utils/newsMeta';

type NewsCardProps = {
  news: NewsItem;
  onPress: () => void;
};

function getLocalizedText(item: NewsItem, field: 'title' | 'content', language: string) {
  const normalized = language.startsWith('kz') || language.startsWith('kk')
    ? 'kz'
    : language.startsWith('ru')
      ? 'ru'
      : 'en';
  const localizedField = normalized === 'en' ? field : `${field}_${normalized}`;
  return String((item as Record<string, unknown>)[localizedField] ?? item[field] ?? '');
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Дата не указана';
  }

  return format(date, 'dd.MM.yyyy');
}

function formatPeriodLabel(start?: string, end?: string) {
  if (!start) {
    return '';
  }

  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const startLabel = Number.isNaN(startDate.getTime()) ? '' : format(startDate, 'dd.MM HH:mm');
  const endLabel =
    endDate && !Number.isNaN(endDate.getTime()) ? format(endDate, 'dd.MM HH:mm') : '';

  if (!startLabel) {
    return '';
  }

  return endLabel ? `${startLabel} - ${endLabel}` : startLabel;
}

export function NewsCard({ news, onPress }: NewsCardProps) {
  const { i18n } = useTranslation();
  const types = useMemo(() => getNewsTypes(news), [news]);
  const primaryType = types[0];
  const primaryMeta = getNewsTypeMeta(primaryType);
  const category = getNewsCategory(news);
  const location = getNewsLocation(news);
  const period = getNewsPeriod(news);
  const title = getLocalizedText(news, 'title', i18n.language);
  const content = getLocalizedText(news, 'content', i18n.language);
  const otherTypes = types.slice(1);
  const periodLabel = formatPeriodLabel(period.start, period.end);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      <View style={[styles.sideAccent, { backgroundColor: primaryMeta.color }]} />
      <View style={styles.headerRow}>
        <View style={styles.headerMain}>
          <View style={[styles.iconWrap, { backgroundColor: primaryMeta.color }]}>
            <MaterialCommunityIcons name={primaryMeta.icon} size={26} color="#FFFFFF" />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.typeLabel, { color: primaryMeta.color }]} numberOfLines={1}>
              {primaryType}
            </Text>
            <Text style={styles.dateLabel}>{formatDateLabel(news.created_at)}</Text>
          </View>
        </View>
        <View style={styles.categoryChip}>
          <Text style={styles.categoryChipText}>{category}</Text>
        </View>
      </View>

      {otherTypes.length > 0 ? (
        <View style={styles.typeDotsRow}>
          {otherTypes.map((type) => {
            const meta = getNewsTypeMeta(type);
            return (
              <View key={`${news.id}-${type}`} style={[styles.typeDotBadge, { borderColor: `${meta.color}33` }]}>
                <View style={[styles.typeDot, { backgroundColor: meta.color }]} />
                <Text style={[styles.typeDotText, { color: meta.color }]} numberOfLines={1}>
                  {type}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.preview} numberOfLines={3}>
        {content}
      </Text>

      {location || periodLabel ? (
        <View style={styles.footer}>
          {location ? (
            <View style={styles.footerItem}>
              <MaterialCommunityIcons name="map-marker-outline" size={14} color="#7C8798" />
              <Text style={styles.footerText} numberOfLines={1}>
                {location}
              </Text>
            </View>
          ) : null}
          {periodLabel ? (
            <View style={styles.footerItem}>
              <MaterialCommunityIcons name="calendar-clock-outline" size={14} color="#7C8798" />
              <Text style={styles.footerText} numberOfLines={1}>
                {periodLabel}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    overflow: 'hidden',
  },
  sideAccent: {
    position: 'absolute',
    left: 0,
    top: 18,
    bottom: 18,
    width: 5,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 2,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  typeLabel: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  dateLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  categoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: NEWS_CATEGORY_COLOR,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  categoryChipText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  typeDotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeDotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  typeDotText: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    lineHeight: 25,
    color: '#1F2937',
    fontWeight: '800',
  },
  preview: {
    fontSize: 14,
    lineHeight: 21,
    color: '#4B5563',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 2,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  footerText: {
    fontSize: 12,
    color: '#7C8798',
    fontWeight: '600',
  },
});

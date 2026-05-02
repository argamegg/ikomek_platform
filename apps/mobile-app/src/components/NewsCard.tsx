import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { NewsItem } from '../utils/api';
import {
  getBorderColor,
  getNewsCategory,
  getNewsPeriod,
  getNewsTypeMeta,
  getNewsTypes,
  NEWS_CATEGORY_COLOR,
} from '../utils/newsMeta';
import { getNewsCardSizes, useResponsive } from '../utils/responsive';

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

  const startDate = new Date(start.endsWith('Z') ? start : `${start}Z`);
  const endDate = end ? new Date(end.endsWith('Z') ? end : `${end}Z`) : null;
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
  const { isTablet } = useResponsive();
  const sizes = useMemo(() => getNewsCardSizes(isTablet), [isTablet]);
  const styles = useMemo(() => createStyles(sizes), [sizes]);
  const types = useMemo(() => getNewsTypes(news), [news]);
  const primaryType = types[0];
  const primaryMeta = getNewsTypeMeta(primaryType);
  const category = getNewsCategory(news);
  const period = getNewsPeriod(news);
  const title = getLocalizedText(news, 'title', i18n.language);
  const content = getLocalizedText(news, 'content', i18n.language);
  const otherTypes = types.slice(1);
  const periodLabel = formatPeriodLabel(period.start, period.end);
  const borderColor = getBorderColor(period.start, period.end);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      <View style={[styles.sideAccent, { backgroundColor: borderColor }]} />
      <View style={styles.headerRow}>
        <View style={styles.headerMain}>
          <View style={[styles.iconWrap, { backgroundColor: primaryMeta.color }]}>
            <MaterialCommunityIcons name={primaryMeta.icon} size={sizes.iconSize} color="#FFFFFF" />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.typeLabel, { color: primaryMeta.color }]} numberOfLines={1}>
              {primaryType}
            </Text>
            <Text style={styles.dateLabel}>{formatDateLabel(news.created_at)}</Text>
          </View>
        </View>
      </View>

      {otherTypes.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeDotsRow}
        >
          {otherTypes.map((type) => {
            const meta = getNewsTypeMeta(type);
            return (
              <View key={`${news.id}-${type}`} style={[styles.typeDotBadge, { borderColor: `${meta.color}33` }]}>
                <MaterialCommunityIcons name={meta.icon} size={sizes.typeIconSize} color={meta.color} />
                <Text style={[styles.typeDotText, { color: meta.color }]} numberOfLines={1}>
                  {type}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.preview} numberOfLines={3}>
        {content}
      </Text>

      {periodLabel ? (
        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={sizes.footerIconSize}
              color="#7C8798"
            />
            <Text style={styles.footerText} numberOfLines={1}>
              {periodLabel}
            </Text>
          </View>
          <View style={styles.categoryChip}>
            <Text style={styles.categoryChipText}>{category}</Text>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function createStyles(sizes: ReturnType<typeof getNewsCardSizes>) {
  return StyleSheet.create({
    card: {
      position: 'relative',
      backgroundColor: '#FFFFFF',
      borderRadius: sizes.borderRadius,
      paddingHorizontal: sizes.paddingHorizontal,
      paddingVertical: sizes.paddingVertical,
      gap: sizes.gap,
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: sizes.shadowOffsetHeight },
      shadowOpacity: 0.08,
      shadowRadius: sizes.shadowRadius,
      elevation: sizes.elevation,
      overflow: 'hidden',
    },
    sideAccent: {
      position: 'absolute',
      left: 0,
      top: sizes.sideAccentInset,
      bottom: sizes.sideAccentInset,
      width: sizes.sideAccentWidth,
      borderTopRightRadius: 999,
      borderBottomRightRadius: 999,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: sizes.headerGap,
    },
    headerMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.headerGap,
      flex: 1,
    },
    iconWrap: {
      width: sizes.iconWrapSize,
      height: sizes.iconWrapSize,
      borderRadius: sizes.iconWrapRadius,
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
      fontSize: sizes.typeLabelSize,
      lineHeight: sizes.typeLabelLineHeight,
      fontWeight: '800',
    },
    dateLabel: {
      fontSize: sizes.dateLabelSize,
      color: '#6B7280',
      fontWeight: '600',
    },
    categoryChip: {
      alignSelf: 'flex-start',
      backgroundColor: NEWS_CATEGORY_COLOR,
      borderRadius: 999,
      paddingHorizontal: sizes.categoryChipHorizontal,
      paddingVertical: sizes.categoryChipVertical,
    },
    categoryChipText: {
      fontSize: sizes.categoryChipTextSize,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    typeDotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.typeBadgeGap,
      paddingRight: 4,
    },
    typeDotBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.typeBadgeGap,
      paddingHorizontal: sizes.typeBadgeHorizontal,
      paddingVertical: sizes.typeBadgeVertical,
      borderRadius: 999,
      backgroundColor: '#F8FAFC',
      borderWidth: 1,
    },
    typeDotText: {
      fontSize: sizes.typeDotTextSize,
      fontWeight: '700',
    },
    title: {
      fontSize: sizes.titleSize,
      lineHeight: sizes.titleLineHeight,
      color: '#1F2937',
      fontWeight: '800',
    },
    preview: {
      fontSize: sizes.previewSize,
      lineHeight: sizes.previewLineHeight,
      color: '#4B5563',
      fontWeight: '500',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: sizes.footerGap,
      paddingTop: 2,
    },
    footerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '100%',
    },
    footerText: {
      fontSize: sizes.footerTextSize,
      color: '#7C8798',
      fontWeight: '600',
    },
  });
}

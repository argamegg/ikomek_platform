import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NewsCategory, NewsItem, NewsType } from './api';

export const NEWS_CATEGORY_COLOR = '#FB8C00';

export const NEWS_TYPE_OPTIONS: {
  label: NewsType;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  defaultCategory: NewsCategory;
}[] = [
  {
    label: 'Аварийные работы',
    color: '#E53935',
    icon: 'alert-rhombus-outline',
    defaultCategory: 'Коммунальные услуги',
  },
  {
    label: 'Погодные условия',
    color: '#1E88E5',
    icon: 'weather-partly-cloudy',
    defaultCategory: 'Погода',
  },
  {
    label: 'Плановые работы',
    color: '#FB8C00',
    icon: 'hammer-wrench',
    defaultCategory: 'Коммунальные услуги',
  },
  {
    label: 'Дорожные ситуации',
    color: '#F9A825',
    icon: 'traffic-cone',
    defaultCategory: 'Дороги',
  },
  {
    label: 'Управление образования',
    color: '#3949AB',
    icon: 'bookshelf',
    defaultCategory: 'Образование',
  },
  {
    label: 'Мероприятия города',
    color: '#43A047',
    icon: 'city-variant-outline',
    defaultCategory: 'Благоустройство',
  },
];

export const NEWS_CATEGORY_OPTIONS: NewsCategory[] = [
  'Дороги',
  'Коммунальные услуги',
  'Транспорт',
  'Образование',
  'Погода',
  'Благоустройство',
];

const LEGACY_NEWS_TYPE_MAP: Record<string, NewsType> = {
  critical: 'Аварийные работы',
  warning: 'Плановые работы',
  info: 'Мероприятия города',
  information: 'Мероприятия города',
};

const typeLookup = new Map(NEWS_TYPE_OPTIONS.map((item) => [item.label, item]));

export function isNewsCategory(value: unknown): value is NewsCategory {
  return typeof value === 'string' && NEWS_CATEGORY_OPTIONS.includes(value as NewsCategory);
}

export function isNewsType(value: unknown): value is NewsType {
  return typeof value === 'string' && typeLookup.has(value as NewsType);
}

export function getNewsTypeMeta(type: NewsType) {
  return typeLookup.get(type) ?? NEWS_TYPE_OPTIONS[0];
}

export function getNewsTypes(item: NewsItem): NewsType[] {
  const rawValues = Array.isArray(item.types)
    ? item.types
    : item.type
      ? [item.type]
      : [];

  const resolved = rawValues.filter(isNewsType);
  if (resolved.length > 0) {
    return resolved;
  }

  const legacy = LEGACY_NEWS_TYPE_MAP[String(item.category ?? '').toLowerCase()];
  return legacy ? [legacy] : ['Мероприятия города'];
}

export function getNewsCategory(item: NewsItem): NewsCategory {
  if (isNewsCategory(item.category)) {
    return item.category;
  }

  const firstType = getNewsTypes(item)[0];
  return getNewsTypeMeta(firstType).defaultCategory;
}

export function getNewsLocation(item: NewsItem) {
  return item.location?.trim() || '';
}

export function getNewsPeriod(item: NewsItem) {
  const start = item.start_at || item.period_start || item.created_at;
  const end = item.end_at || item.period_end || '';
  return { start, end };
}

export function formatNewsRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 'Создано недавно';
  }

  const diffMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));

  if (diffMinutes < 60) {
    return `Создано ${diffMinutes} мин назад`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `Создано ${diffHours} ч назад`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `Создано ${diffDays} д назад`;
}

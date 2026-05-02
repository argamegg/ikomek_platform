import {
  Building2,
  CloudSun,
  Construction,
  LibraryBig,
  TriangleAlert,
  type LucideIcon,
  TrafficCone,
} from "lucide-react";
import type { NewsItem } from "../../types/platform";

export type NewsType = NewsItem["types"][number];
export type NewsCategory = NewsItem["category"];

export const NEWS_CATEGORY_COLOR = "#FB8C00";

export const NEWS_CATEGORY_OPTIONS: NewsCategory[] = [
  "Дороги",
  "Коммунальные услуги",
  "Транспорт",
  "Образование",
  "Погода",
  "Благоустройство",
];

export const NEWS_TYPE_OPTIONS: Array<{
  label: NewsType;
  color: string;
  icon: LucideIcon;
  defaultCategory: NewsCategory;
}> = [
  { label: "Аварийные работы", color: "#E53935", icon: TriangleAlert, defaultCategory: "Коммунальные услуги" },
  { label: "Погодные условия", color: "#1E88E5", icon: CloudSun, defaultCategory: "Погода" },
  { label: "Плановые работы", color: "#FB8C00", icon: Construction, defaultCategory: "Коммунальные услуги" },
  { label: "Дорожные ситуации", color: "#F9A825", icon: TrafficCone, defaultCategory: "Дороги" },
  { label: "Управление образования", color: "#3949AB", icon: LibraryBig, defaultCategory: "Образование" },
  { label: "Мероприятия города", color: "#43A047", icon: Building2, defaultCategory: "Благоустройство" },
];

const legacyTypeMap: Record<string, NewsType> = {
  critical: "Аварийные работы",
  warning: "Плановые работы",
  info: "Мероприятия города",
  information: "Мероприятия города",
};

const typeLookup = new Map(NEWS_TYPE_OPTIONS.map((item) => [item.label, item]));

export function isNewsCategory(value: unknown): value is NewsCategory {
  return typeof value === "string" && NEWS_CATEGORY_OPTIONS.includes(value as NewsCategory);
}

export function isNewsType(value: unknown): value is NewsType {
  return typeof value === "string" && typeLookup.has(value as NewsType);
}

export function getNewsTypeMeta(type: NewsType) {
  return typeLookup.get(type) ?? NEWS_TYPE_OPTIONS[0];
}

export function getNewsTypes(item: {
  category?: unknown;
  priority?: unknown;
  type?: unknown;
  types?: unknown;
}): NewsType[] {
  const rawValues = Array.isArray(item.types) ? item.types : item.type ? [item.type] : [];
  const resolved = rawValues.filter(isNewsType);

  if (resolved.length > 0) {
    return resolved;
  }

  const legacy = legacyTypeMap[String(item.category ?? item.priority ?? "").toLowerCase()];
  return legacy ? [legacy] : ["Мероприятия города"];
}

export function getNewsCategory(item: {
  category?: unknown;
  priority?: unknown;
  type?: unknown;
  types?: unknown;
}) {
  if (isNewsCategory(item.category)) {
    return item.category;
  }

  return getNewsTypeMeta(getNewsTypes(item)[0]).defaultCategory;
}

export function formatNewsRelativeTime(value: string, locale = "ru") {
  if (!value) {
    return locale === "en" ? "Created recently" : "Создано недавно";
  }

  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (Number.isNaN(diffMinutes)) {
    return locale === "en" ? "Created recently" : "Создано недавно";
  }

  if (diffMinutes < 60) {
    return locale === "en" ? `Created ${diffMinutes} min ago` : `Создано ${diffMinutes} мин назад`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return locale === "en" ? `Created ${diffHours} h ago` : `Создано ${diffHours} ч назад`;
  }

  const diffDays = Math.round(diffHours / 24);
  return locale === "en" ? `Created ${diffDays} d ago` : `Создано ${diffDays} д назад`;
}

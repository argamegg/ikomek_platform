import type {
  Locale,
  NotificationItem,
  RequestPriority,
  RequestStatus,
  UserRole,
} from "../../types/platform";

const statusToneMap: Record<string, "neutral" | "warning" | "success" | "danger" | "info"> = {
  pending: "warning",
  open: "warning",
  in_progress: "info",
  resolved: "success",
  closed: "success",
  rejected: "danger",
};

const priorityBadgeClassMap: Record<RequestPriority, string> = {
  unset: "ui-badge--priority-unset",
  high: "ui-badge--priority-high",
  medium: "ui-badge--priority-medium",
  low: "ui-badge--priority-low",
};

export function formatDate(value: string, locale: Locale = "en") {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const ADDRESS_REPLACEMENTS: Record<Locale, Array<[RegExp, string]>> = {
  en: [
    [/\bул\.\s*([^,]+),/gi, "$1 Street,"],
    [/\bпр\.\s*([^,]+),/gi, "$1 Avenue,"],
    [/\bпер\.\s*([^,]+),/gi, "$1 Lane,"],
    [/Достық көшесі/gi, "Dostyq Street"],
    [/Есіл ауданы/gi, "Esil district"],
    [/Астана/gi, "Astana"],
    [/Қазақстан/gi, "Kazakhstan"],
  ],
  ru: [
    [/\bLandmark\b/gi, "Ориентир"],
    [/Достық көшесі/gi, "улица Достык"],
    [/\bDostyq Street\b/gi, "улица Достык"],
    [/\bEsil district\b/gi, "район Есиль"],
    [/\bAlmaty district\b/gi, "район Алматы"],
    [/\bSaryarka district\b/gi, "район Сарыарка"],
    [/\bBaikonyr district\b/gi, "район Байконыр"],
    [/\bAstana\b/gi, "Астана"],
    [/\bKazakhstan\b/gi, "Казахстан"],
  ],
  kz: [
    [/\bул\.\s*([^,]+),/gi, "$1 көшесі,"],
    [/\bпр\.\s*([^,]+),/gi, "$1 даңғылы,"],
    [/\bпер\.\s*([^,]+),/gi, "$1 тұйық көшесі,"],
    [/\bLandmark\b/gi, "Бағдар"],
    [/\bDostyq Street\b/gi, "Достық көшесі"],
    [/\bEsil district\b/gi, "Есіл ауданы"],
    [/\bAlmaty district\b/gi, "Алматы ауданы"],
    [/\bSaryarka district\b/gi, "Сарыарқа ауданы"],
    [/\bBaikonyr district\b/gi, "Байқоңыр ауданы"],
    [/\bAstana\b/gi, "Астана"],
    [/\bKazakhstan\b/gi, "Қазақстан"],
  ],
};

function normalizeAddressLocale(locale: Locale | string): Locale {
  if (locale.startsWith("ru")) return "ru";
  if (locale.startsWith("kk") || locale.startsWith("kz")) return "kz";
  return "en";
}

export function formatAddress(value: string | undefined | null, locale: Locale | string = "en") {
  if (!value) {
    return "—";
  }

  const displayLocale = normalizeAddressLocale(locale);

  const withoutPostalCode = value
    .replace(/\b[A-Z]\d{2}[A-Z]\d[A-Z]\d\b,?\s*/g, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",");

  return ADDRESS_REPLACEMENTS[displayLocale].reduce(
    (address, [pattern, replacement]) => address.replace(pattern, replacement),
    withoutPostalCode,
  ).replace(/\s{2,}/g, " ").replace(/,\s*$/g, "").trim();
}

export function formatRelativeTime(value: string, locale: Locale = "en") {
  if (!value) {
    return "—";
  }

  const now = Date.now();
  const target = new Date(value).getTime();
  const diff = Math.round((target - now) / 60000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (Math.abs(diff) < 60) {
    return formatter.format(diff, "minute");
  }

  const hours = Math.round(diff / 60);
  if (Math.abs(hours) < 24) {
    return formatter.format(hours, "hour");
  }

  return formatter.format(Math.round(hours / 24), "day");
}

export function formatStatus(status: RequestStatus) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getStatusTone(status: RequestStatus) {
  return statusToneMap[status] ?? "neutral";
}

export function getPriorityBadgeClass(priority: RequestPriority) {
  return priorityBadgeClassMap[priority] ?? priorityBadgeClassMap.unset;
}

export function formatRole(role: UserRole) {
  return role.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatNotificationType(type: NotificationItem["type"]) {
  return type.replace(/\b\w/g, (char) => char.toUpperCase());
}

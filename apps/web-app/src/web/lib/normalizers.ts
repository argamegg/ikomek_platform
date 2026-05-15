import type {
  AuthResponse,
  CivicRequest,
  District,
  Locale,
  NewsPriority,
  NewsItem,
  NewsListResponse,
  NotificationItem,
  PlatformMetrics,
  RequestAttachment,
  RequestCategory,
  RequestMessage,
  RequestPriority,
  RequestReason,
  RequestStatus,
  RequestStatusHistoryItem,
  SavedLocation,
  SavedLocationType,
  User,
  UserRole,
} from "../../types/platform";
import { getNewsCategory, getNewsTypes } from "./newsMeta";
import { session } from "./session";

export const typeKeyMap: Record<string, string> = {
  "Аварийные работы": "news.types.emergency",
  "Погодные условия": "news.types.weather",
  "Плановые работы": "news.types.planned",
  "Дорожные ситуации": "news.types.road",
  "Управление образования": "news.types.education",
  "Мероприятия города": "news.types.events",
};

export const categoryKeyMap: Record<string, string> = {
  "Дороги": "news.categories.roads",
  "Коммунальные услуги": "news.categories.utilities",
  "Транспорт": "news.categories.transport",
  "Образование": "news.categories.education",
  "Погода": "news.categories.weather",
  "Благоустройство": "news.categories.improvement",
};

function toUtcDate(dateStr: string) {
  return new Date(dateStr.endsWith("Z") ? dateStr : `${dateStr}Z`);
}

export function formatNewsDate(dateStr: string): string {
  if (!dateStr) {
    return "—";
  }

  const date = toUtcDate(dateStr);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

export function formatNewsPeriod(dateStr: string): string {
  if (!dateStr) {
    return "";
  }

  const date = toUtcDate(dateStr);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day}.${month} ${hours}:${minutes}`;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    if (key in record && record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }

  return undefined;
}

function asString(value: unknown, fallback = "") {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return fallback;
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value === "true";
  }

  return fallback;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  return fallback;
}

function asArray<T = unknown>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getCurrentLocale(): Locale {
  const stored = session.getLocale();
  if (stored === "ru" || stored === "kz" || stored === "en") {
    return stored;
  }

  if (typeof navigator !== "undefined") {
    if (navigator.language.startsWith("ru")) {
      return "ru";
    }

    if (navigator.language.startsWith("kk") || navigator.language.startsWith("kz")) {
      return "kz";
    }
  }

  return "en";
}

function localizedKeys(baseKey: string, locale: Locale) {
  if (locale === "ru") {
    return [`${baseKey}_ru`, `${baseKey}`];
  }

  if (locale === "kz") {
    return [`${baseKey}_kz`, `${baseKey}`];
  }

  return [`${baseKey}_en`, baseKey, `${baseKey}_ru`, `${baseKey}_kz`];
}

export function unwrapPayload<T>(payload: unknown): T {
  if (!isRecord(payload)) {
    return payload as T;
  }

  const nested = pick(payload, ["data", "result", "results", "item"]);
  return (nested ?? payload) as T;
}

export function unwrapList(payload: unknown): unknown[] {
  const unwrapped = unwrapPayload<unknown>(payload);

  if (Array.isArray(unwrapped)) {
    return unwrapped;
  }

  if (isRecord(unwrapped)) {
    const items = pick(unwrapped, ["items", "results", "rows", "content"]);
    return asArray(items);
  }

  return [];
}

function normalizeRole(value: unknown): UserRole {
  return (asString(value, "citizen") || "citizen").toLowerCase() as UserRole;
}

function normalizeStatus(value: unknown): RequestStatus {
  return (asString(value, "pending") || "pending").toLowerCase() as RequestStatus;
}

function normalizePriority(value: unknown): RequestPriority {
  const normalized = (asString(value, "medium") || "medium").toLowerCase();
  return normalized === "low" || normalized === "medium" || normalized === "high"
    ? normalized
    : "medium";
}

function normalizeNewsPriority(value: unknown): NewsPriority | "" {
  const normalized = asString(value).toLowerCase();
  if (normalized === "critical" || normalized === "warning" || normalized === "information") {
    return normalized;
  }
  if (normalized === "info") {
    return "information";
  }
  return "";
}

export function normalizeUser(payload: unknown): User {
  const record = isRecord(unwrapPayload<JsonRecord>(payload)) ? unwrapPayload<JsonRecord>(payload) : {};
  const rolesValue = pick(record, ["roles", "user_roles"]);
  const roles = Array.isArray(rolesValue)
    ? rolesValue.map((item) => normalizeRole(item))
    : [normalizeRole(pick(record, ["primaryRole", "role", "user_role"]))];
  const language = asString(pick(record, ["language", "lang"]), "ru") as Locale;

  return {
    id: asString(pick(record, ["id", "userId", "uuid"]), "guest"),
    name: asString(pick(record, ["name", "full_name", "fullName"]), "iKOMEK user"),
    email: asString(pick(record, ["email"]), ""),
    phone: asString(pick(record, ["phone", "phone_number"])),
    displayName: asString(pick(record, ["displayName", "display_name", "preferred_name"])),
    gender: asString(pick(record, ["gender", "sex"])),
    birthDate: asString(pick(record, ["birthDate", "birth_date", "date_of_birth"])),
    primaryRole: roles[0] ?? "citizen",
    roles,
    language,
    notificationsEnabled: asBoolean(
      pick(record, ["notificationsEnabled", "notifications_enabled"]),
      true,
    ),
    avatarUrl: asString(pick(record, ["avatarUrl", "avatar_url", "avatar", "photo", "image_url"])),
    createdAt: asString(pick(record, ["createdAt", "created_at", "registered_at"])),
    departmentName: asString(pick(record, ["departmentName", "department_name"])),
  };
}

export function normalizeAuthResponse(payload: unknown): AuthResponse {
  const record = isRecord(unwrapPayload<JsonRecord>(payload)) ? unwrapPayload<JsonRecord>(payload) : {};
  const userValue = pick(record, ["user", "profile"]);

  return {
    accessToken: asString(pick(record, ["accessToken", "access_token", "token"])),
    token: asString(pick(record, ["token", "access_token", "accessToken"])),
    user: userValue ? normalizeUser(userValue) : undefined,
  };
}

export function normalizeDistrict(payload: unknown): District {
  const record = isRecord(payload) ? payload : {};

  return {
    id: asString(pick(record, ["id", "districtId", "uuid"]), crypto.randomUUID()),
    name: asString(pick(record, ["name", "title"]), "District"),
    code: asString(pick(record, ["code", "slug"])),
    requestDensity: asNumber(pick(record, ["requestDensity", "request_density"])),
  };
}

export function normalizeCategory(payload: unknown): RequestCategory {
  const record = isRecord(payload) ? payload : {};
  const id = asString(pick(record, ["id", "categoryId", "uuid"]), crypto.randomUUID());
  const locale = getCurrentLocale();

  return {
    id,
    name: asString(
      pick(record, [...localizedKeys("name", locale), ...localizedKeys("title", locale)]),
      "Category",
    ),
    nameRu: asString(pick(record, ["name_ru", "nameRu"])),
    nameKz: asString(pick(record, ["name_kz", "name_kk", "nameKz", "nameKk"])),
    code: asString(pick(record, ["code", "slug"]), id),
    icon: asString(pick(record, ["icon", "icon_name"])),
  };
}

export function normalizeReason(payload: unknown): RequestReason {
  const record = isRecord(payload) ? payload : {};

  return {
    id: asString(pick(record, ["id", "reasonId", "uuid"]), crypto.randomUUID()),
    categoryId: asString(pick(record, ["categoryId", "category_id"]), ""),
    name: asString(pick(record, ["name", "title"]), "Reason"),
    placeOptions: asArray<string>(pick(record, ["placeOptions", "place_options", "places"])).map(
      (item) => asString(item),
    ),
    description: asString(pick(record, ["description"])),
  };
}

export function normalizeSavedLocation(payload: unknown): SavedLocation {
  const record = isRecord(payload) ? payload : {};
  const pointValue = pick(record, ["point", "coordinates", "geo"]) as unknown;
  const pointRecord = isRecord(pointValue) ? pointValue : {};
  const rawType = asString(pick(record, ["type", "name", "place_type"]), "other");
  const type = (["home", "work", "study", "family", "other"].includes(rawType) ? rawType : "other") as SavedLocationType;

  return {
    id: asString(pick(record, ["id", "locationId", "uuid"]), crypto.randomUUID()),
    label: asString(pick(record, ["label", "name"]), "Saved place"),
    type,
    address: asString(pick(record, ["address", "fullAddress", "full_address"]), ""),
    districtId: asString(pick(record, ["districtId", "district_id"]), ""),
    point: {
      lat: asNumber(pick(pointRecord, ["lat", "latitude"]), asNumber(pick(record, ["lat", "latitude"]))),
      lng: asNumber(
        pick(pointRecord, ["lng", "lon", "longitude"]),
        asNumber(pick(record, ["lng", "lon", "longitude"])),
      ),
    },
  };
}

export function normalizeAttachment(payload: unknown): RequestAttachment {
  const record = isRecord(payload) ? payload : {};
  const url = asString(pick(record, ["url", "file", "fileUrl", "file_url"]));
  const type = url.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? "image" : "document";

  return {
    id: asString(pick(record, ["id", "attachmentId", "uuid"]), crypto.randomUUID()),
    type,
    label: asString(pick(record, ["label", "name", "file_name"]), "Attachment"),
    url,
    thumbnailUrl: asString(pick(record, ["thumbnailUrl", "thumbnail_url", "preview"])),
  };
}

export function normalizeStatusHistory(payload: unknown): RequestStatusHistoryItem {
  const record = isRecord(payload) ? payload : {};
  const status = normalizeStatus(pick(record, ["status", "state"]));

  return {
    id: asString(pick(record, ["id", "uuid"]), crypto.randomUUID()),
    status,
    label: asString(pick(record, ["label", "title"]), status),
    note: asString(pick(record, ["note", "comment", "description"])),
    timestamp: asString(
      pick(record, ["timestamp", "createdAt", "created_at", "updated_at"]),
      new Date().toISOString(),
    ),
  };
}

export function normalizeMessage(payload: unknown): RequestMessage {
  const record = isRecord(payload) ? payload : {};
  const senderType = asString(pick(record, ["sender_type", "senderType", "role"]), "operator");

  return {
    id: asString(pick(record, ["id", "messageId", "uuid"]), crypto.randomUUID()),
    senderRole: normalizeRole(
      pick(record, ["senderRole", "sender_role", "role"]) ?? senderType,
    ),
    senderName: asString(pick(record, ["senderName", "sender_name", "author"]), "Operator"),
    message: asString(pick(record, ["message", "text", "body", "content"]), ""),
    timestamp: asString(
      pick(record, ["timestamp", "createdAt", "created_at"]),
      new Date().toISOString(),
    ),
    attachmentLabel: asString(pick(record, ["attachmentLabel", "attachment_name"])),
    attachmentUrl: asString(pick(record, ["attachmentUrl", "attachment_url"])),
  };
}

export function normalizeRequest(payload: unknown): CivicRequest {
  const record = isRecord(unwrapPayload<JsonRecord>(payload)) ? unwrapPayload<JsonRecord>(payload) : {};
  const pointValue = pick(record, ["point", "coordinates", "geo"]);
  const pointRecord = isRecord(pointValue) ? pointValue : {};
  const photos = asArray<string>(pick(record, ["photos", "resolution_photos"])).filter(Boolean);
  const attachments = [
    ...asArray(pick(record, ["attachments", "files"])).map(normalizeAttachment),
    ...photos.map((photo, index) =>
      normalizeAttachment({
        id: `${asString(pick(record, ["id", "requestId", "uuid"]), "request")}-photo-${index}`,
        url: photo,
        name: `Photo ${index + 1}`,
      }),
    ),
  ];
  const messages = asArray(pick(record, ["messages", "chat", "chat_messages"])).map(normalizeMessage);
  const history = asArray(
    pick(record, ["statusHistory", "status_history", "history", "events"]),
  ).map(normalizeStatusHistory);
  const priority = normalizePriority(pick(record, ["priority", "severity"]));
  const status = normalizeStatus(pick(record, ["status", "state"]));
  const assignedDepartment = asString(pick(record, ["assignedDepartment", "assigned_department"]));

  return {
    id: asString(pick(record, ["id", "requestId", "uuid"]), crypto.randomUUID()),
    citizenId: asString(pick(record, ["citizenId", "citizen_id", "userId", "user_id"]), ""),
    citizenName: asString(pick(record, ["citizenName", "citizen_name", "user_name"])),
    title: asString(
      pick(record, ["title", "subject", "problem_type"]),
      asString(pick(record, ["reasonName", "reason_name"]), "City request"),
    ),
    address: asString(pick(record, ["address", "fullAddress", "full_address"]), ""),
    districtId: asString(pick(record, ["districtId", "district_id"]), ""),
    point: {
      lat: asNumber(pick(pointRecord, ["lat", "latitude"]), asNumber(pick(record, ["lat", "latitude"]))),
      lng: asNumber(
        pick(pointRecord, ["lng", "lon", "longitude"]),
        asNumber(pick(record, ["lng", "lon", "longitude"])),
      ),
    },
    place: asString(pick(record, ["place", "location_hint", "place_type"]), ""),
    categoryId: asString(pick(record, ["categoryId", "category_id"]), ""),
    categoryName: asString(pick(record, ["categoryName", "category_name", "category"])),
    reasonId: asString(pick(record, ["reasonId", "reason_id", "reason"]), ""),
    reasonName: asString(pick(record, ["reasonName", "reason_name", "reason"])),
    description: asString(pick(record, ["description", "details", "body"]), ""),
    status,
    statusLabel: asString(pick(record, ["statusLabel", "status_label"]), status),
    priority,
    createdAt: asString(
      pick(record, ["createdAt", "created_at", "registered_at"]),
      new Date().toISOString(),
    ),
    updatedAt: asString(
      pick(record, ["updatedAt", "updated_at", "status_updated_at"]),
      new Date().toISOString(),
    ),
    isPublic: asBoolean(pick(record, ["isPublic", "is_public"]), false),
    attachments,
    statusHistory: history.length > 0 ? history : [normalizeStatusHistory({ status, label: status })],
    messages,
    assignment: assignedDepartment
      ? { id: assignedDepartment, departmentName: assignedDepartment }
      : undefined,
    internalNote: asString(pick(record, ["internalNote", "internal_note", "operator_notes"])),
  };
}

export function normalizeNews(payload: unknown): NewsItem {
  const record = isRecord(payload) ? payload : {};
  const locale = getCurrentLocale();
  const body = asString(
    pick(record, [
      ...localizedKeys("body", locale),
      ...localizedKeys("content", locale),
      ...localizedKeys("description", locale),
    ]),
    "",
  );
  const rawCategory = asString(pick(record, ["category", "news_category", "topic"]), "");
  const rawTypes = pick(record, ["types", "type", "labels"]);
  const types = getNewsTypes({
    category: rawCategory || asString(pick(record, ["category", "type"]), "info"),
    type: typeof rawTypes === "string" ? rawTypes : undefined,
    types: Array.isArray(rawTypes) ? rawTypes : undefined,
    priority: pick(record, ["priority", "severity", "type", "category"]),
  });
  const category = getNewsCategory({
    category: rawCategory,
    type: typeof rawTypes === "string" ? rawTypes : undefined,
    types: Array.isArray(rawTypes) ? rawTypes : undefined,
    priority: pick(record, ["priority", "severity", "type", "category"]),
  });
  const fallbackPriority: NewsPriority =
    types[0] === "Аварийные работы"
      ? "critical"
      : types[0] === "Плановые работы" || types[0] === "Дорожные ситуации"
        ? "warning"
        : "information";
  const priority = normalizeNewsPriority(pick(record, ["priority", "severity"])) || fallbackPriority;

  return {
    id: asString(pick(record, ["id", "newsId", "uuid"]), crypto.randomUUID()),
    title: asString(pick(record, localizedKeys("title", locale)), "City update"),
    titleRu: asString(pick(record, ["title_ru", "titleRu"])),
    titleKz: asString(pick(record, ["title_kz", "titleKz"])),
    titleEn: asString(pick(record, ["title_en", "titleEn"])),
    category,
    types,
    priority,
    summary: asString(
      pick(record, [
        ...localizedKeys("summary", locale),
        ...localizedKeys("lead", locale),
        ...localizedKeys("excerpt", locale),
      ]),
      body.slice(0, 160),
    ),
    summaryRu: asString(pick(record, ["summary_ru", "summaryRu"])),
    summaryKz: asString(pick(record, ["summary_kz", "summaryKz"])),
    summaryEn: asString(pick(record, ["summary_en", "summaryEn"])),
    body,
    bodyRu: asString(pick(record, ["content_ru", "contentRu", "body_ru", "bodyRu"])),
    bodyKz: asString(pick(record, ["content_kz", "contentKz", "body_kz", "bodyKz"])),
    bodyEn: asString(pick(record, ["content_en", "contentEn", "body_en", "bodyEn"])),
    location: asString(pick(record, ["location", "district"])),
    sourceLang: asString(pick(record, ["source_lang", "sourceLang"])),
    translationStatus: asString(
      pick(record, ["translation_status", "translationStatus"]),
    ) as NewsItem["translationStatus"],
    startAt: asString(
      pick(record, ["startAt", "start_at", "publishedAt", "published_at", "created_at"]),
      new Date().toISOString(),
    ),
    endAt: asString(pick(record, ["endAt", "end_at"])),
    imageUrl: asString(pick(record, ["imageUrl", "image_url", "cover", "image"])),
    publishedAt: asString(pick(record, ["publishedAt", "published_at", "created_at"])),
    updatedAt: asString(pick(record, ["updatedAt", "updated_at"])),
    isActive: asBoolean(pick(record, ["isActive", "is_active"]), true),
  };
}

export function normalizeNewsListResponse(payload: unknown): NewsListResponse {
  const record = isRecord(unwrapPayload<JsonRecord>(payload)) ? unwrapPayload<JsonRecord>(payload) : {};
  const items = pick(record, ["news", "items"]);
  const news = Array.isArray(items) ? items.map((item) => normalizeNews(item)) : normalizeList(payload, normalizeNews);

  return {
    news,
    total: asNumber(pick(record, ["total"]), news.length),
    page: asNumber(pick(record, ["page"]), 1),
    limit: asNumber(pick(record, ["limit"]), news.length || 20),
  };
}

export function normalizeNotification(payload: unknown): NotificationItem {
  const record = isRecord(payload) ? payload : {};

  return {
    id: asString(pick(record, ["id", "notificationId", "uuid"]), crypto.randomUUID()),
    title: asString(pick(record, ["title", "message"]), "Notification"),
    type: asString(pick(record, ["type"]), "status") as NotificationItem["type"],
    createdAt: asString(
      pick(record, ["createdAt", "created_at"]),
      new Date().toISOString(),
    ),
    description: asString(pick(record, ["description", "body"])),
  };
}

export function normalizeMetrics(payload: unknown): PlatformMetrics {
  const record = isRecord(unwrapPayload<JsonRecord>(payload)) ? unwrapPayload<JsonRecord>(payload) : {};
  const requestsValue = pick(record, ["requests"]);
  const requestsRecord = isRecord(requestsValue) ? requestsValue : {};
  const categoriesValue = pick(record, ["categories"]);
  const categoriesRecord = isRecord(categoriesValue) ? categoriesValue : {};
  const categories = Object.entries(categoriesRecord).filter(([, value]) => typeof value === "number");
  const topCategory =
    categories.sort((a, b) => asNumber(b[1]) - asNumber(a[1]))[0]?.[0] ?? "—";
  const activeRequests = asNumber(
    pick(record, ["activeRequests", "active_requests"]),
    asNumber(pick(requestsRecord, ["in_progress"])),
  );
  const pendingRequests = asNumber(
    pick(record, ["pendingRequests", "pending_requests"]),
    asNumber(pick(requestsRecord, ["pending"])),
  );
  const closedRequests = asNumber(
    pick(record, ["closedRequests", "closed_requests"]),
    asNumber(pick(requestsRecord, ["closed"])),
  );

  return {
    totalRequests: asNumber(
      pick(record, ["totalRequests", "total_requests"]),
      asNumber(pick(requestsRecord, ["total"])),
    ),
    activeRequests,
    pendingRequests,
    closedRequests,
    averageResponseTime: asString(
      pick(record, ["averageResponseTime", "average_response_time"]),
      "—",
    ),
    topCategory: asString(pick(record, ["topCategory", "top_category"]), topCategory),
    satisfactionRate: asString(pick(record, ["satisfactionRate", "satisfaction_rate"])),
  };
}

export function normalizeList<T>(
  payload: unknown,
  mapper: (value: unknown) => T,
) {
  return unwrapList(payload).map(mapper);
}

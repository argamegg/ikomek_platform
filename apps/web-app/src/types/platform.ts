export type Locale = "en" | "ru" | "kz";

export type UserRole = "citizen" | "operator" | "admin" | "executor" | string;

export type RequestStatus =
  | "pending"
  | "in_progress"
  | "closed"
  | "open"
  | "resolved"
  | "rejected"
  | string;

export type RequestPriority = "low" | "medium" | "high";

export type NewsPriority = "critical" | "warning" | "information";

export type SavedLocationType =
  | "home"
  | "work"
  | "study"
  | "road"
  | "environment"
  | "other";

export type MapMode = "all" | "my" | "heatmap";

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type District = {
  id: string;
  name: string;
  code?: string;
  requestDensity?: number;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  primaryRole: UserRole;
  roles: UserRole[];
  language: Locale;
  notificationsEnabled: boolean;
  avatarUrl?: string;
  createdAt?: string;
  departmentName?: string;
};

export type SavedLocation = {
  id: string;
  label: string;
  type: SavedLocationType;
  address: string;
  districtId: string;
  point: GeoPoint;
};

export type RequestCategory = {
  id: string;
  name: string;
  nameRu?: string;
  nameKz?: string;
  code: string;
  icon?: string;
};

export type RequestReason = {
  id: string;
  categoryId: string;
  name: string;
  placeOptions: string[];
  description?: string;
};

export type RequestAttachment = {
  id: string;
  type: "image" | "document";
  label: string;
  url: string;
  thumbnailUrl?: string;
};

export type RequestStatusHistoryItem = {
  id: string;
  status: RequestStatus;
  label: string;
  note: string;
  timestamp: string;
};

export type RequestMessage = {
  id: string;
  senderRole: UserRole;
  senderName: string;
  message: string;
  timestamp: string;
  attachmentLabel?: string;
  attachmentUrl?: string;
  isOwn?: boolean;
};

export type DepartmentAssignment = {
  id: string;
  departmentName: string;
  executorName?: string;
  eta?: string;
};

export type CivicRequest = {
  id: string;
  citizenId: string;
  citizenName?: string;
  title: string;
  address: string;
  districtId: string;
  point: GeoPoint;
  place: string;
  categoryId: string;
  categoryName?: string;
  reasonId: string;
  reasonName?: string;
  description: string;
  status: RequestStatus;
  statusLabel?: string;
  priority: RequestPriority;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  attachments: RequestAttachment[];
  statusHistory: RequestStatusHistoryItem[];
  messages: RequestMessage[];
  assignment?: DepartmentAssignment;
  internalNote?: string;
};

export type NewsItem = {
  id: string;
  title: string;
  titleRu?: string;
  titleKz?: string;
  titleEn?: string;
  category:
    | "Дороги"
    | "Коммунальные услуги"
    | "Транспорт"
    | "Образование"
    | "Погода"
    | "Благоустройство";
  types: Array<
    | "Аварийные работы"
    | "Погодные условия"
    | "Плановые работы"
    | "Дорожные ситуации"
    | "Управление образования"
    | "Мероприятия города"
  >;
  priority?: NewsPriority;
  summary: string;
  summaryRu?: string;
  summaryKz?: string;
  summaryEn?: string;
  body: string;
  bodyRu?: string;
  bodyKz?: string;
  bodyEn?: string;
  location?: string;
  sourceLang?: "ru" | "kk" | "en" | string;
  translationStatus?: "translated" | "failed" | "skipped" | string;
  startAt: string;
  endAt?: string;
  imageUrl?: string;
  publishedAt?: string;
  updatedAt?: string;
  isActive?: boolean;
};

export type NewsListResponse = {
  news: NewsItem[];
  total: number;
  page: number;
  limit: number;
};

export type NewsTranslationPreview = {
  sourceLang: "ru" | "kk" | "en";
  translations: {
    ru: { title: string; content: string; summary: string };
    kk: { title: string; content: string; summary: string };
    en: { title: string; content: string; summary: string };
  };
};

export type NotificationItem = {
  id: string;
  title: string;
  type: "status" | "news" | "chat";
  createdAt: string;
  description?: string;
};

export type PlatformMetrics = {
  totalRequests: number;
  activeRequests: number;
  pendingRequests: number;
  closedRequests?: number;
  averageResponseTime: string;
  topCategory: string;
  satisfactionRate?: string;
};

export type OperatorStatsRecentRequest = {
  id: string;
  address: string;
  categoryName: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type OperatorMonthlyActivity = {
  month: string;
  count: number;
};

export type OperatorStats = {
  totalAssigned: number;
  inProgress: number;
  closed: number;
  pendingQueue: number;
  avgCloseDays: number;
  monthlyActivity: OperatorMonthlyActivity[];
  recentRequests: OperatorStatsRecentRequest[];
};

export type AdminTopCategory = {
  id: string;
  name: string;
  count: number;
};

export type AdminOperatorWorkload = {
  operatorId: string;
  operatorName: string;
  inProgress: number;
  closed: number;
  total: number;
};

export type AdminPlatformStats = {
  totalRequests: number;
  pending: number;
  inProgress: number;
  closed: number;
  totalUsers: number;
  totalOperators: number;
  topCategories: AdminTopCategory[];
  monthlyActivity: OperatorMonthlyActivity[];
  operatorsWorkload: AdminOperatorWorkload[];
};

export type PublicPlatformData = {
  categories: RequestCategory[];
  reasons: RequestReason[];
  districts: District[];
  news: NewsItem[];
  alerts: NewsItem[];
  publicRequests: CivicRequest[];
};

export type PrivatePlatformData = {
  currentUser: User | null;
  savedLocations: SavedLocation[];
  notifications: NotificationItem[];
  citizenRequests: CivicRequest[];
  operatorQueue: CivicRequest[];
  metrics: PlatformMetrics | null;
};

export type PlatformContextData = PublicPlatformData &
  PrivatePlatformData & {
    loading: boolean;
    isAuthenticated: boolean;
    error: string | null;
  };

export type AuthLoginInput = {
  email: string;
  password: string;
};

export type AuthRegisterInput = {
  name: string;
  email: string;
  phone?: string;
  password: string;
  language: Locale;
};

export type PasswordRecoveryInput = {
  email: string;
};

export type EmailVerificationInput = {
  registrationId: string;
  code: string;
};

export type ResendVerificationInput = {
  registrationId: string;
};

export type AuthResponse = {
  accessToken?: string;
  token?: string;
  user?: User;
};

export type AuthRegistrationChallenge = {
  status: "verification_required";
  registrationId: string;
  email: string;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
};

export type RequestCreateInput = {
  address: string;
  savedLocationId?: string;
  lat?: number;
  lng?: number;
  place: string;
  categoryId: string;
  reasonId: string;
  description: string;
  isPublic: boolean;
  attachments: File[];
};

export type RequestStatusUpdateInput = {
  status: RequestStatus;
  departmentName?: string;
  internalNote?: string;
  priority?: RequestPriority;
};

export type RequestMessageInput = {
  message: string;
  attachment?: File | null;
};

export type AIAssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AIAssistantInput = {
  message: string;
  history: AIAssistantChatMessage[];
  locale: Locale;
};

export type AIAssistantAction = {
  type: "navigate";
  label: string;
  web_path?: string | null;
  mobile_path?: string | null;
  request_id?: string | null;
};

export type AIAssistantResponse = {
  reply: string;
  configured: boolean;
  model: string;
  actions: AIAssistantAction[];
};

export type UserProfileUpdateInput = {
  name: string;
  phone: string;
  language: Locale;
  notificationsEnabled: boolean;
};

export type SavedLocationInput = {
  label: string;
  type: SavedLocationType;
  address: string;
  districtId: string;
  lat: number;
  lng: number;
};

export type NewsCreateInput = {
  title: string;
  category: NewsItem["category"];
  types: NewsItem["types"];
  summary: string;
  body: string;
  location: string;
  startAt: string;
  endAt?: string;
  titleRu?: string;
  titleKz?: string;
  titleEn?: string;
  bodyRu?: string;
  bodyKz?: string;
  bodyEn?: string;
  summaryRu?: string;
  summaryKz?: string;
  summaryEn?: string;
  sourceLang?: "ru" | "kk" | "en";
  translationStatus?: "translated" | "failed" | "skipped" | string;
  skipTranslation?: boolean;
};

export type RouteConfig = {
  label: string;
  path: string;
  requiresAuth?: boolean;
  roles?: UserRole[];
};

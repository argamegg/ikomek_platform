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

export type RequestPriority =
  | "critical"
  | "warning"
  | "information"
  | "high"
  | "medium"
  | "low"
  | string;

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
  category: string;
  priority: RequestPriority;
  summary: string;
  body: string;
  location?: string;
  startAt: string;
  endAt?: string;
  imageUrl?: string;
  publishedAt?: string;
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
};

export type RequestMessageInput = {
  message: string;
  attachment?: File | null;
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
  category: string;
  priority: RequestPriority;
  summary: string;
  body: string;
  location: string;
  startAt: string;
  endAt?: string;
};

export type RouteConfig = {
  label: string;
  path: string;
  requiresAuth?: boolean;
  roles?: UserRole[];
};

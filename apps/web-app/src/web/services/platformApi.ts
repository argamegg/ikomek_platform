import axios from "axios";
import { apiConfig, buildWsPath } from "../../config/api";
import type {
  AuthLoginInput,
  AuthRegistrationChallenge,
  AuthRegisterInput,
  ClerkLoginInput,
  AdminPlatformStats,
  AIAssistantInput,
  AIAssistantResponse,
  CivicRequest,
  District,
  EmailVerificationInput,
  NewsCreateInput,
  NewsItem,
  NewsListResponse,
  NewsTranslationPreview,
  NotificationItem,
  OperatorStats,
  Locale,
  PasswordRecoveryInput,
  PasswordChangeInput,
  PasswordSetInput,
  PlatformMetrics,
  RequestCategory,
  RequestCreateInput,
  RequestMessage,
  RequestMessageInput,
  RequestReason,
  RequestStatus,
  RequestStatusUpdateInput,
  ResendVerificationInput,
  SavedLocation,
  SavedLocationInput,
  User,
  UserProfileUpdateInput,
} from "../../types/platform";
import {
  normalizeAuthResponse,
  normalizeCategory,
  normalizeDistrict,
  normalizeList,
  normalizeMessage,
  normalizeMetrics,
  normalizeNews,
  normalizeNewsListResponse,
  normalizeNotification,
  normalizeReason,
  normalizeRequest,
  normalizeSavedLocation,
  normalizeUser,
} from "../lib/normalizers";
import { session } from "../lib/session";

const ASTANA_DISTRICTS: District[] = [
  { id: "esil", name: "Есиль", code: "esil" },
  { id: "saryarka", name: "Сарыарка", code: "saryarka" },
  { id: "almaty", name: "Алматы", code: "almaty" },
  { id: "baikonyr", name: "Байконыр", code: "baikonyr" },
];

const REQUEST_REASON_TEMPLATES: Record<string, Array<{ id: string; name: string }>> = {
  electricity: [
    { id: "infrastructure", name: "Infrastructure failure" },
    { id: "weather", name: "Weather damage" },
    { id: "overload", name: "System overload" },
    { id: "maintenance", name: "Needs maintenance" },
    { id: "accident", name: "Accident or external damage" },
  ],
  water: [
    { id: "pipe_burst", name: "Pipe burst" },
    { id: "maintenance", name: "Scheduled maintenance" },
    { id: "infrastructure", name: "Old infrastructure" },
    { id: "pressure", name: "Pressure issue" },
    { id: "unknown", name: "Unknown cause" },
  ],
  heating: [
    { id: "boiler", name: "Boiler issue" },
    { id: "pipe", name: "Pipe problem" },
    { id: "system", name: "System failure" },
    { id: "regulation", name: "Temperature regulation" },
    { id: "maintenance", name: "Needs maintenance" },
  ],
  public_order: [
    { id: "resident", name: "Resident complaint" },
    { id: "safety", name: "Public safety concern" },
    { id: "community", name: "Community concern" },
    { id: "legal", name: "Legal violation" },
    { id: "recurring", name: "Recurring issue" },
  ],
  sewage: [
    { id: "blockage", name: "Blockage" },
    { id: "wear", name: "Pipe wear" },
    { id: "overflow", name: "Overflow" },
    { id: "odor", name: "Odor issue" },
    { id: "unknown", name: "Unknown cause" },
  ],
  waste: [
    { id: "schedule", name: "Schedule issue" },
    { id: "container", name: "Container damage" },
    { id: "illegal", name: "Illegal dumping" },
    { id: "volume", name: "Volume increase" },
    { id: "access", name: "Access problem" },
  ],
  roads: [
    { id: "weather", name: "Weather wear" },
    { id: "traffic", name: "Heavy traffic damage" },
    { id: "construction", name: "Construction damage" },
    { id: "age", name: "Age deterioration" },
    { id: "accident", name: "Accident damage" },
  ],
  other: [{ id: "general", name: "General issue" }],
};

const DEFAULT_PLACE_OPTIONS = ["apartment", "house", "office", "street", "park", "other"];

function getCurrentLang(): string {
  const lang =
    session.getLocale() ||
    (typeof navigator !== "undefined" ? navigator.language : "ru") ||
    "ru";

  if (lang.startsWith("kz") || lang.startsWith("kk")) {
    return "kk";
  }

  if (lang.startsWith("en")) {
    return "en";
  }

  return "ru";
}

export const queryKeys = {
  currentUser: ["current-user"] as const,
  categories: ["categories"] as const,
  reasons: ["reasons"] as const,
  districts: ["districts"] as const,
  news: ["news"] as const,
  alerts: ["alerts"] as const,
  publicRequests: ["public-requests"] as const,
  myRequests: ["my-requests"] as const,
  allRequests: (status?: RequestStatus) => ["all-requests", status ?? "all"] as const,
  request: (requestId: string) => ["request", requestId] as const,
  requestMessages: (requestId: string) => ["request-messages", requestId] as const,
  metrics: ["metrics"] as const,
  operatorStats: ["operator-stats"] as const,
  adminStats: ["admin-stats"] as const,
  savedLocations: ["saved-locations"] as const,
  notifications: ["notifications"] as const,
};

export const platformClient = axios.create({
  baseURL: apiConfig.baseUrl,
  withCredentials: true,
});

platformClient.interceptors.request.use((config) => {
  const token = session.getToken();

  if (token) {
    config.headers.Authorization = `${apiConfig.tokenPrefix} ${token}`;
  }

  return config;
});

platformClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      session.clearToken();
    }

    return Promise.reject(error);
  },
);

export function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; detail?: string } | undefined;
    return data?.detail ?? data?.message ?? error.response?.statusText ?? error.message;
  }

  return error instanceof Error ? error.message : "Unexpected API error";
}

export function isUnauthorized(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

function isForbidden(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 403;
}

function resolvePath(template: string, params: Record<string, string>) {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, value),
    template,
  );
}

function buildReasonCatalog(): RequestReason[] {
  return Object.entries(REQUEST_REASON_TEMPLATES).flatMap(([categoryId, reasons]) =>
    reasons.map((reason) =>
      normalizeReason({
        id: `${categoryId}-${reason.id}`,
        category_id: categoryId,
        name: reason.name,
        place_options: DEFAULT_PLACE_OPTIONS,
      }),
    ),
  );
}

function findReasonLabel(reasonId: string) {
  for (const reasons of Object.values(REQUEST_REASON_TEMPLATES)) {
    const match = reasons.find((reason) => reason.id === reasonId || reasonId.endsWith(`-${reason.id}`));
    if (match) {
      return match.name;
    }
  }

  return reasonId;
}

function toNotificationItem(request: CivicRequest): NotificationItem {
  return normalizeNotification({
    id: `request-${request.id}`,
    title: request.title || request.categoryName || "Request update",
    type: "status",
    created_at: request.updatedAt || request.createdAt,
    description: `${request.statusLabel ?? request.status} • ${request.address}`,
  });
}

function buildDistricts(requests: CivicRequest[]): District[] {
  return ASTANA_DISTRICTS.map((district) => {
    const requestDensity = requests.filter((request) => {
      const value = (request.districtId || "").toLowerCase();
      return value === district.id || value === district.name.toLowerCase();
    }).length;

    return normalizeDistrict({
      ...district,
      request_density: requestDensity,
    });
  });
}

function buildMetricsFromRequests(requests: CivicRequest[]): PlatformMetrics {
  const counts = requests.reduce<Record<string, number>>((accumulator, request) => {
    accumulator[request.categoryId] = (accumulator[request.categoryId] ?? 0) + 1;
    return accumulator;
  }, {});
  const topCategory =
    Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "—";

  return normalizeMetrics({
    requests: {
      total: requests.length,
      pending: requests.filter((request) => request.status === "pending").length,
      in_progress: requests.filter((request) => request.status === "in_progress").length,
      closed: requests.filter((request) => request.status === "closed").length,
    },
    categories: counts,
    average_response_time: "—",
    top_category: topCategory,
  });
}

function mergeRequestMessages(request: CivicRequest, messages: RequestMessage[]) {
  return {
    ...request,
    messages,
  };
}

function canUseRequestInteraction(user: User | null, request: CivicRequest) {
  if (!user) {
    return false;
  }

  return Boolean(request.id);
}

function normalizeRegistrationChallenge(payload: unknown): AuthRegistrationChallenge {
  const record =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

  return {
    status: "verification_required",
    registrationId: String(record.registration_id ?? record.registrationId ?? ""),
    email: String(record.email ?? ""),
    expiresInSeconds: Number(record.expires_in_seconds ?? record.expiresInSeconds ?? 0),
    resendAvailableInSeconds: Number(
      record.resend_available_in_seconds ?? record.resendAvailableInSeconds ?? 0,
    ),
  };
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read attachment"));
    };
    reader.onerror = () => reject(new Error("Unable to read attachment"));
    reader.readAsDataURL(file);
  });
}

async function getAccessibleRequests(status?: RequestStatus) {
  try {
    const response = await platformClient.get("/operator/requests", {
      params: { ...(status ? { status } : {}), lang: getCurrentLang() },
    });
    return normalizeList(response.data, normalizeRequest);
  } catch (error) {
    if (!isForbidden(error)) {
      throw error;
    }

    const response = await platformClient.get("/requests/all", {
      params: { ...(status ? { status } : {}), lang: getCurrentLang() },
    });
    return normalizeList(response.data, normalizeRequest);
  }
}

export const platformApi = {
  normalizeIncomingMessage(payload: unknown): RequestMessage {
    return normalizeMessage(payload);
  },

  async login(payload: AuthLoginInput) {
    const response = await platformClient.post(apiConfig.endpoints.login, payload);
    const normalized = normalizeAuthResponse(response.data);
    const token = normalized.accessToken ?? normalized.token;

    if (token) {
      session.setToken(token);
    }

    return normalized;
  },

  async loginWithClerk(payload: ClerkLoginInput) {
    const response = await platformClient.post(
      "/auth/clerk",
      {
        token: payload.token,
        email: payload.email,
        full_name: payload.fullName,
        phone: payload.phone,
        gender: payload.gender,
        birth_date: payload.birthDate,
        avatar_url: payload.avatarUrl,
      },
      { timeout: 15_000 },
    );
    const normalized = normalizeAuthResponse(response.data);
    const token = normalized.accessToken ?? normalized.token;

    if (token) {
      session.setToken(token);
    }

    return normalized;
  },

  async register(payload: AuthRegisterInput) {
    const response = await platformClient.post(apiConfig.endpoints.register, {
      email: payload.email,
      password: payload.password,
      full_name: payload.name,
      phone: payload.phone,
      language: payload.language,
    });

    return normalizeRegistrationChallenge(response.data);
  },

  async verifyEmail(payload: EmailVerificationInput) {
    const response = await platformClient.post(apiConfig.endpoints.verifyEmail, {
      registration_id: payload.registrationId,
      code: payload.code,
    });
    const normalized = normalizeAuthResponse(response.data);
    const token = normalized.accessToken ?? normalized.token;

    if (token) {
      session.setToken(token);
    }

    return normalized;
  },

  async resendVerification(payload: ResendVerificationInput) {
    const response = await platformClient.post(apiConfig.endpoints.resendVerification, {
      registration_id: payload.registrationId,
    });

    return normalizeRegistrationChallenge(response.data);
  },

  async recoverPassword(_payload: PasswordRecoveryInput) {
    void _payload;
    throw new Error("Password recovery is not available in the current backend yet.");
  },

  async logout() {
    session.clearToken();
  },

  async getCurrentUser(): Promise<User | null> {
    const token = session.getToken();

    if (!token) {
      return null;
    }

    try {
      const response = await platformClient.get(apiConfig.endpoints.currentUser);
      return normalizeUser(response.data);
    } catch (error) {
      if (isUnauthorized(error)) {
        return null;
      }

      throw error;
    }
  },

  async getCategories(): Promise<RequestCategory[]> {
    const response = await platformClient.get(apiConfig.endpoints.requestCategories);
    return normalizeList(response.data, normalizeCategory);
  },

  async getReasons(): Promise<RequestReason[]> {
    return buildReasonCatalog();
  },

  async getDistricts() {
    const token = session.getToken();

    if (!token) {
      return ASTANA_DISTRICTS;
    }

    try {
      const requests = await getAccessibleRequests();
      return buildDistricts(requests);
    } catch {
      return ASTANA_DISTRICTS;
    }
  },

  async getNews(params?: {
    search?: string;
    category?: string;
    type?: string;
    period?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }): Promise<NewsListResponse> {
    const response = await platformClient.get(apiConfig.endpoints.news, {
      params: { lang: getCurrentLang(), ...params },
    });
    return normalizeNewsListResponse(response.data);
  },

  async getAlerts(): Promise<NewsItem[]> {
    const items = await this.getNews({ limit: 20 });
    return items.news.filter((item) =>
      item.types.some((type) =>
        [
          "Аварийные работы",
          "Погодные условия",
          "Плановые работы",
          "Дорожные ситуации",
        ].includes(type),
      ),
    );
  },

  async getPublicRequests(): Promise<CivicRequest[]> {
    const response = await platformClient.get("/requests/all", {
      params: { lang: getCurrentLang() },
    });
    return normalizeList(response.data, normalizeRequest);
  },

  async getMapRequests(params?: { dateFrom?: string; dateTo?: string }): Promise<CivicRequest[]> {
    const response = await platformClient.get("/requests/map", {
      params: {
        date_from: params?.dateFrom,
        date_to: params?.dateTo,
        lang: getCurrentLang(),
      },
    });
    return normalizeList(response.data, normalizeRequest);
  },

  async getMyRequests(): Promise<CivicRequest[]> {
    const token = session.getToken();

    if (!token) {
      return [];
    }

    try {
      const response = await platformClient.get(apiConfig.endpoints.myRequests, {
        params: { lang: getCurrentLang() },
      });
      return normalizeList(response.data, normalizeRequest);
    } catch (error) {
      if (isUnauthorized(error)) {
        return [];
      }

      throw error;
    }
  },

  async getAllRequests(status?: RequestStatus): Promise<CivicRequest[]> {
    try {
      return await getAccessibleRequests(status);
    } catch (error) {
      if (isUnauthorized(error)) {
        return [];
      }

      throw error;
    }
  },

  async getRequestById(requestId: string): Promise<CivicRequest> {
    const requestResponse = await platformClient.get(`${apiConfig.endpoints.requests}/${requestId}`, {
      params: { lang: getCurrentLang() },
    });
    const request = normalizeRequest(requestResponse.data);
    const user = await this.getCurrentUser();

    if (!canUseRequestInteraction(user, request)) {
      return mergeRequestMessages(request, []);
    }

    try {
      const messagesResponse = await platformClient.get(
        resolvePath(apiConfig.endpoints.requestMessages, { requestId }),
      );
      return mergeRequestMessages(request, normalizeList(messagesResponse.data, normalizeMessage));
    } catch (error) {
      if (isUnauthorized(error) || isForbidden(error)) {
        return mergeRequestMessages(request, []);
      }

      throw error;
    }
  },

  async getRequestMessages(requestId: string): Promise<RequestMessage[]> {
    const response = await platformClient.get(
      resolvePath(apiConfig.endpoints.requestMessages, { requestId }),
    );
    return normalizeList(response.data, normalizeMessage);
  },

  getRequestMessagesSocketUrl(requestId: string) {
    const token = session.getToken();
    if (!token) {
      return null;
    }

    const path = resolvePath(apiConfig.endpoints.requestMessages, { requestId });
    const apiPrefix = apiConfig.wsBaseUrl.replace(/\/+$/, "").endsWith("/api") ? "" : "/api";
    return buildWsPath(`${apiPrefix}${path}/ws?token=${encodeURIComponent(token)}`);
  },

  async createRequest(payload: RequestCreateInput): Promise<CivicRequest> {
    const photos = await Promise.all(payload.attachments.map((file) => fileToDataUrl(file)));
    const reasonLabel = findReasonLabel(payload.reasonId);
    const problemType = reasonLabel || payload.categoryId || "New request";
    const response = await platformClient.post(apiConfig.endpoints.requests, {
      category_id: payload.categoryId,
      address: payload.address,
      latitude: payload.lat,
      longitude: payload.lng,
      place_type: payload.place,
      problem_type: problemType,
      reason: reasonLabel || "Submitted from web",
      description: payload.description,
      photos,
      source_lang: getCurrentLang(),
    });

    return normalizeRequest(response.data);
  },

  async updateRequestStatus(requestId: string, payload: RequestStatusUpdateInput) {
    const response = await platformClient.put(
      resolvePath(apiConfig.endpoints.requestStatus, { requestId }),
      {
        status: payload.status,
        assigned_department: payload.departmentName,
        operator_notes: payload.internalNote,
        resolution_notes: payload.resolutionNote,
        priority: payload.priority,
      },
    );

    if (response.data && typeof response.data === "object" && "id" in response.data) {
      return normalizeRequest(response.data);
    }

    return this.getRequestById(requestId);
  },

  async postRequestMessage(requestId: string, payload: RequestMessageInput): Promise<RequestMessage> {
    const attachmentUrl = payload.attachment ? await fileToDataUrl(payload.attachment) : undefined;
    const response = await platformClient.post(
      resolvePath(apiConfig.endpoints.requestMessages, { requestId }),
      {
        content: payload.message,
        attachment_url: attachmentUrl,
        attachment_label: payload.attachment?.name,
        attachment_type: payload.attachment?.type?.startsWith("image/") ? "image" : "file",
      },
    );
    return normalizeMessage(response.data);
  },

  async askAIAssistant(payload: AIAssistantInput): Promise<AIAssistantResponse> {
    const response = await platformClient.post("/ai/assistant", {
      message: payload.message,
      history: payload.history,
      locale: payload.locale,
    });
    const record =
      typeof response.data === "object" && response.data !== null
        ? (response.data as Record<string, unknown>)
        : {};

    return {
      reply: String(record.reply ?? ""),
      configured: Boolean(record.configured),
      model: String(record.model ?? ""),
      actions: Array.isArray(record.actions)
        ? record.actions
            .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
            .map((item) => ({
              type: "navigate" as const,
              label: String(item.label ?? ""),
              web_path: typeof item.web_path === "string" ? item.web_path : null,
              mobile_path: typeof item.mobile_path === "string" ? item.mobile_path : null,
              request_id: typeof item.request_id === "string" ? item.request_id : null,
            }))
            .filter((item) => item.label.length > 0)
        : [],
    };
  },

  async getMetrics(): Promise<PlatformMetrics> {
    try {
      const response = await platformClient.get(apiConfig.endpoints.metrics);
      return normalizeMetrics(response.data);
    } catch (error) {
      if (!isForbidden(error)) {
        throw error;
      }

      const requests = await this.getAllRequests();
      return buildMetricsFromRequests(requests);
    }
  },

  async getOperatorStats(): Promise<OperatorStats> {
    const response = await platformClient.get("/operator/my-stats");
    const data = response.data as {
      total_assigned?: number;
      in_progress?: number;
      closed?: number;
      pending_queue?: number;
      avg_close_days?: number;
      monthly_activity?: Array<{ month?: string; count?: number }>;
      recent_requests?: Array<{
        id?: string;
        address?: string;
        category_name?: string;
        status?: RequestStatus;
        created_at?: string;
        updated_at?: string;
      }>;
    };

    return {
      totalAssigned: Number(data.total_assigned ?? 0),
      inProgress: Number(data.in_progress ?? 0),
      closed: Number(data.closed ?? 0),
      pendingQueue: Number(data.pending_queue ?? 0),
      avgCloseDays: Number(data.avg_close_days ?? 0),
      monthlyActivity: (data.monthly_activity ?? []).map((item) => ({
        month: String(item.month ?? ""),
        count: Number(item.count ?? 0),
      })),
      recentRequests: (data.recent_requests ?? [])
        .map((item) => ({
          id: String(item.id ?? ""),
          address: String(item.address ?? ""),
          categoryName: String(item.category_name ?? ""),
          status: String(item.status ?? "pending") as RequestStatus,
          createdAt: String(item.created_at ?? ""),
          updatedAt: String(item.updated_at ?? ""),
        }))
        .sort((first, second) => {
          const firstRawTime = new Date(first.updatedAt || first.createdAt).getTime();
          const secondRawTime = new Date(second.updatedAt || second.createdAt).getTime();
          const firstTime = Number.isFinite(firstRawTime) ? firstRawTime : 0;
          const secondTime = Number.isFinite(secondRawTime) ? secondRawTime : 0;
          return secondTime - firstTime;
        }),
    };
  },

  async getAdminStats(): Promise<AdminPlatformStats> {
    const response = await platformClient.get("/admin/platform-stats");
    const data = response.data as {
      total_requests?: number;
      pending?: number;
      in_progress?: number;
      closed?: number;
      total_users?: number;
      total_operators?: number;
      top_categories?: Array<{ id?: string; name?: string; count?: number }>;
      monthly_activity?: Array<{ month?: string; count?: number }>;
      operators_workload?: Array<{
        operator_id?: string;
        operator_name?: string;
        in_progress?: number;
        closed?: number;
        total?: number;
      }>;
    };

    return {
      totalRequests: Number(data.total_requests ?? 0),
      pending: Number(data.pending ?? 0),
      inProgress: Number(data.in_progress ?? 0),
      closed: Number(data.closed ?? 0),
      totalUsers: Number(data.total_users ?? 0),
      totalOperators: Number(data.total_operators ?? 0),
      topCategories: (data.top_categories ?? []).map((item) => ({
        id: String(item.id ?? item.name ?? ""),
        name: String(item.name ?? ""),
        count: Number(item.count ?? 0),
      })),
      monthlyActivity: (data.monthly_activity ?? []).map((item) => ({
        month: String(item.month ?? ""),
        count: Number(item.count ?? 0),
      })),
      operatorsWorkload: (data.operators_workload ?? []).map((item) => ({
        operatorId: String(item.operator_id ?? ""),
        operatorName: String(item.operator_name ?? ""),
        inProgress: Number(item.in_progress ?? 0),
        closed: Number(item.closed ?? 0),
        total: Number(item.total ?? 0),
      })),
    };
  },

  async getSavedLocations(): Promise<SavedLocation[]> {
    const token = session.getToken();

    if (!token) {
      return [];
    }

    try {
      const response = await platformClient.get(apiConfig.endpoints.savedLocations);
      return normalizeList(response.data, normalizeSavedLocation);
    } catch (error) {
      if (isUnauthorized(error)) {
        return [];
      }

      throw error;
    }
  },

  async createSavedLocation(payload: SavedLocationInput) {
    const response = await platformClient.post(apiConfig.endpoints.savedLocations, {
      name: payload.type,
      label: payload.label,
      address: payload.address,
      latitude: payload.lat,
      longitude: payload.lng,
    });
    return normalizeSavedLocation(response.data);
  },

  async deleteSavedLocation(locationId: string) {
    await platformClient.delete(`${apiConfig.endpoints.savedLocations}/${locationId}`);
  },

  async updateProfile(payload: UserProfileUpdateInput) {
    const profilePayload = {
      full_name: payload.name,
      phone: payload.phone,
      display_name: payload.displayName,
      gender: payload.gender,
      birth_date: payload.birthDate,
      avatar_url: payload.avatarUrl,
    };
    await platformClient.put("/auth/profile", profilePayload);
    await platformClient.put("/auth/language", { language: payload.language });
    return (await platformApi.getCurrentUser()) as User;
  },

  async updateLanguage(language: Locale) {
    await platformClient.put("/auth/language", { language });
    return (await platformApi.getCurrentUser()) as User;
  },

  async changePassword(payload: PasswordChangeInput) {
    await platformClient.put("/auth/password", {
      current_password: payload.currentPassword,
      new_password: payload.newPassword,
    });
  },

  async setLocalPassword(payload: PasswordSetInput) {
    const response = await platformClient.put("/auth/local-password", {
      new_password: payload.newPassword,
    });
    return normalizeUser(response.data);
  },

  async getNotifications() {
    const [requests, news] = await Promise.all([this.getMyRequests(), this.getNews()]);
    return [
      ...requests.slice(0, 4).map(toNotificationItem),
      ...news.news.slice(0, 3).map((item) =>
        normalizeNotification({
          id: `news-${item.id}`,
          title: item.title,
          type: "news",
          created_at: item.publishedAt || item.startAt,
          description: item.summary,
        }),
      ),
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  },

  async createNews(payload: NewsCreateInput) {
    const primaryType = payload.types[0];
    const legacyPriority =
      primaryType === "Аварийные работы"
        ? "critical"
        : primaryType === "Плановые работы" || primaryType === "Дорожные ситуации"
          ? "warning"
          : "information";
    const content = payload.body || payload.summary;
    const sourceLang = getCurrentLang();
    const response = await platformClient.post("/admin/news", {
      title: payload.title,
      title_ru: payload.titleRu ?? (sourceLang === "ru" ? payload.title : undefined),
      title_kz: payload.titleKz ?? (sourceLang === "kk" ? payload.title : undefined),
      title_en: payload.titleEn ?? (sourceLang === "en" ? payload.title : undefined),
      content,
      content_ru: payload.bodyRu ?? (sourceLang === "ru" ? content : undefined),
      content_kz: payload.bodyKz ?? (sourceLang === "kk" ? content : undefined),
      content_en: payload.bodyEn ?? (sourceLang === "en" ? content : undefined),
      category: payload.category,
      types: payload.types,
      type: primaryType,
      priority: legacyPriority,
      summary: payload.summary,
      summary_ru: payload.summaryRu,
      summary_kz: payload.summaryKz,
      summary_en: payload.summaryEn,
      location: payload.location,
      start_at: payload.startAt,
      end_at: payload.endAt,
      source_lang: payload.sourceLang ?? sourceLang,
      translation_status: payload.translationStatus,
      skip_translation: payload.skipTranslation ?? false,
    });
    return normalizeNews(response.data);
  },

  async previewNewsTranslation(payload: { title: string; content: string; summary?: string }): Promise<NewsTranslationPreview> {
    const response = await platformClient.post("/admin/news/translate-preview", payload);
    const record =
      typeof response.data === "object" && response.data !== null
        ? (response.data as Record<string, unknown>)
        : {};
    const translations =
      typeof record.translations === "object" && record.translations !== null
        ? (record.translations as Record<string, unknown>)
        : {};
    const readTranslation = (language: string, field: string) => {
      const value = translations[language];
      const languageRecord =
        typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
      return String(languageRecord[field] ?? "");
    };

    return {
      sourceLang: String(record.source_lang ?? record.sourceLang ?? "ru") as NewsTranslationPreview["sourceLang"],
      translations: {
        ru: {
          title: readTranslation("ru", "title"),
          content: readTranslation("ru", "content"),
          summary: readTranslation("ru", "summary"),
        },
        kk: {
          title: readTranslation("kk", "title"),
          content: readTranslation("kk", "content"),
          summary: readTranslation("kk", "summary"),
        },
        en: {
          title: readTranslation("en", "title"),
          content: readTranslation("en", "content"),
          summary: readTranslation("en", "summary"),
        },
      },
    };
  },

  async updateNews(newsId: string, payload: NewsCreateInput) {
    const response = await platformClient.put(`/admin/news/${newsId}`, {
      title: payload.title,
      title_ru: payload.titleRu,
      title_kz: payload.titleKz,
      title_en: payload.titleEn,
      content: payload.body,
      content_ru: payload.bodyRu,
      content_kz: payload.bodyKz,
      content_en: payload.bodyEn,
      summary: payload.summary,
      summary_ru: payload.summaryRu,
      summary_kz: payload.summaryKz,
      summary_en: payload.summaryEn,
      category: payload.category,
      types: payload.types,
      type: payload.types[0],
      location: payload.location,
      start_at: payload.startAt,
      end_at: payload.endAt,
      source_lang: payload.sourceLang ?? getCurrentLang(),
      translation_status: payload.translationStatus,
    });
    return normalizeNews(response.data);
  },

  async deleteNews(newsId: string) {
    await platformClient.delete(`/admin/news/${newsId}`);
  },
};

import axios from "axios";
import { apiConfig } from "../../config/api";
import type {
  AuthLoginInput,
  AuthRegisterInput,
  CivicRequest,
  District,
  NewsCreateInput,
  NewsItem,
  NotificationItem,
  PasswordRecoveryInput,
  PlatformMetrics,
  RequestCategory,
  RequestCreateInput,
  RequestMessage,
  RequestMessageInput,
  RequestReason,
  RequestStatus,
  RequestStatusUpdateInput,
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
  metrics: ["metrics"] as const,
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
      params: status ? { status } : undefined,
    });
    return normalizeList(response.data, normalizeRequest);
  } catch (error) {
    if (!isForbidden(error)) {
      throw error;
    }

    const response = await platformClient.get("/requests/all", {
      params: status ? { status } : undefined,
    });
    return normalizeList(response.data, normalizeRequest);
  }
}

export const platformApi = {
  async login(payload: AuthLoginInput) {
    const response = await platformClient.post(apiConfig.endpoints.login, payload);
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
    });
    const normalized = normalizeAuthResponse(response.data);
    const token = normalized.accessToken ?? normalized.token;

    if (token) {
      session.setToken(token);
    }

    if (payload.language && payload.language !== "ru") {
      await platformClient.put("/auth/language", { language: payload.language });
    }

    return {
      ...normalized,
      user: normalized.user ? { ...normalized.user, language: payload.language } : normalized.user,
    };
  },

  async recoverPassword(_payload: PasswordRecoveryInput) {
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

  async getNews(): Promise<NewsItem[]> {
    const response = await platformClient.get(apiConfig.endpoints.news);
    return normalizeList(response.data, normalizeNews);
  },

  async getAlerts(): Promise<NewsItem[]> {
    const items = await this.getNews();
    return items.filter((item) => item.category === "critical" || item.category === "warning");
  },

  async getPublicRequests(): Promise<CivicRequest[]> {
    const token = session.getToken();

    if (!token) {
      return [];
    }

    const response = await platformClient.get("/requests/all");
    return normalizeList(response.data, normalizeRequest);
  },

  async getMyRequests(): Promise<CivicRequest[]> {
    try {
      const response = await platformClient.get(apiConfig.endpoints.myRequests);
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
    const [requestResponse, messagesResponse] = await Promise.all([
      platformClient.get(`${apiConfig.endpoints.requests}/${requestId}`),
      platformClient.get(resolvePath(apiConfig.endpoints.requestMessages, { requestId })),
    ]);

    return mergeRequestMessages(
      normalizeRequest(requestResponse.data),
      normalizeList(messagesResponse.data, normalizeMessage),
    );
  },

  async createRequest(payload: RequestCreateInput): Promise<CivicRequest> {
    const photos = await Promise.all(payload.attachments.map((file) => fileToDataUrl(file)));
    const reasonLabel = findReasonLabel(payload.reasonId);
    const problemType = reasonLabel || payload.categoryId || "New request";
    const response = await platformClient.post(apiConfig.endpoints.requests, {
      category_id: payload.categoryId,
      address: payload.address,
      latitude: payload.lat ?? 51.1282,
      longitude: payload.lng ?? 71.4306,
      place_type: payload.place,
      problem_type: problemType,
      reason: reasonLabel || "Submitted from web",
      description: payload.description,
      photos,
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
      },
    );

    if (response.data && typeof response.data === "object" && "id" in response.data) {
      return normalizeRequest(response.data);
    }

    return this.getRequestById(requestId);
  },

  async postRequestMessage(requestId: string, payload: RequestMessageInput): Promise<RequestMessage> {
    const response = await platformClient.post(
      resolvePath(apiConfig.endpoints.requestMessages, { requestId }),
      { content: payload.message },
    );
    return normalizeMessage(response.data);
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

  async getSavedLocations(): Promise<SavedLocation[]> {
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

  async updateProfile(payload: UserProfileUpdateInput) {
    await platformClient.put("/auth/profile", null, {
      params: {
        full_name: payload.name,
        phone: payload.phone,
      },
    });
    await platformClient.put("/auth/language", { language: payload.language });
    return (await this.getCurrentUser()) as User;
  },

  async getNotifications() {
    const [requests, news] = await Promise.all([this.getMyRequests(), this.getNews()]);
    return [
      ...requests.slice(0, 4).map(toNotificationItem),
      ...news.slice(0, 3).map((item) =>
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
    const category =
      payload.priority === "critical" || payload.category === "critical"
        ? "critical"
        : payload.priority === "warning" || payload.category === "warning"
          ? "warning"
          : "info";
    const content = payload.body || payload.summary;
    const response = await platformClient.post("/admin/news", {
      title: payload.title,
      title_ru: payload.title,
      title_kz: payload.title,
      content,
      content_ru: content,
      content_kz: content,
      category,
    });
    return normalizeNews(response.data);
  },
};

const fallbackBaseUrl = "http://localhost:8001";

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function deriveWsBaseUrl(baseUrl: string) {
  if (baseUrl.startsWith("https://")) {
    return baseUrl.replace("https://", "wss://");
  }

  if (baseUrl.startsWith("http://")) {
    return baseUrl.replace("http://", "ws://");
  }

  return baseUrl;
}

function withApiPrefix(baseUrl: string) {
  const normalized = stripTrailingSlash(baseUrl);
  return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
}

export const apiConfig = {
  baseUrl: withApiPrefix(import.meta.env.VITE_API_BASE_URL ?? fallbackBaseUrl),
  wsBaseUrl: stripTrailingSlash(
    import.meta.env.VITE_WS_BASE_URL ??
      deriveWsBaseUrl(import.meta.env.VITE_API_BASE_URL ?? fallbackBaseUrl),
  ),
  tokenPrefix: import.meta.env.VITE_API_TOKEN_PREFIX ?? "Bearer",
  endpoints: {
    login: import.meta.env.VITE_API_LOGIN_PATH ?? "/auth/login",
    register: import.meta.env.VITE_API_REGISTER_PATH ?? "/auth/register",
    recoverPassword: import.meta.env.VITE_API_RECOVER_PASSWORD_PATH ?? "",
    logout: import.meta.env.VITE_API_LOGOUT_PATH ?? "",
    currentUser: import.meta.env.VITE_API_CURRENT_USER_PATH ?? "/auth/me",
    savedLocations: import.meta.env.VITE_API_SAVED_LOCATIONS_PATH ?? "/locations",
    notifications: import.meta.env.VITE_API_NOTIFICATIONS_PATH ?? "",
    requestCategories: import.meta.env.VITE_API_REQUEST_CATEGORIES_PATH ?? "/categories",
    requestReasons: import.meta.env.VITE_API_REQUEST_REASONS_PATH ?? "",
    districts: import.meta.env.VITE_API_DISTRICTS_PATH ?? "",
    requests: import.meta.env.VITE_API_REQUESTS_PATH ?? "/requests",
    myRequests: import.meta.env.VITE_API_MY_REQUESTS_PATH ?? "/requests",
    news: import.meta.env.VITE_API_NEWS_PATH ?? "/news",
    alerts: import.meta.env.VITE_API_ALERTS_PATH ?? "/news",
    requestMessages:
      import.meta.env.VITE_API_REQUEST_MESSAGES_PATH ?? "/requests/:requestId/messages",
    requestStatus: import.meta.env.VITE_API_REQUEST_STATUS_PATH ?? "/operator/requests/:requestId",
    metrics: import.meta.env.VITE_API_REQUEST_METRICS_PATH ?? "/admin/analytics",
    openapi: import.meta.env.VITE_API_OPENAPI_PATH ?? "/openapi.json",
  },
};

export function buildPath(path: string) {
  return `${apiConfig.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildWsPath(path: string) {
  return `${apiConfig.wsBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

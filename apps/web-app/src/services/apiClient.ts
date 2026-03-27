import { apiConfig, buildPath } from "../config/api";
import { sessionService } from "./sessionService";

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type ApiRequestOptions = {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: FormData | Record<string, unknown>;
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
};

function createUrl(path: string, query?: ApiRequestOptions["query"]) {
  const url = new URL(buildPath(path));

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

export async function apiClient<T>({
  path,
  method = "GET",
  body,
  auth = false,
  query,
}: ApiRequestOptions): Promise<T> {
  const headers = new Headers({
    Accept: "application/json",
  });

  if (!(body instanceof FormData) && body) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = sessionService.getToken();

    if (token) {
      headers.set("Authorization", `${apiConfig.tokenPrefix} ${token}`);
    }
  }

  const response = await fetch(createUrl(path, query), {
    method,
    headers,
    credentials: "include",
    body:
      body instanceof FormData
        ? body
        : body
          ? JSON.stringify(body)
          : undefined,
  });

  const text = await response.text();
  let payload: unknown;

  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

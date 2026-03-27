import { apiConfig } from "../config/api";
import type { NewsCreateInput, NewsItem } from "../types/platform";
import { apiClient } from "./apiClient";

export const newsService = {
  getNews() {
    return apiClient<NewsItem[]>({
      path: apiConfig.endpoints.news,
    });
  },
  getAlerts() {
    return apiClient<NewsItem[]>({
      path: apiConfig.endpoints.alerts,
    });
  },
  createNewsItem(payload: NewsCreateInput) {
    return apiClient<NewsItem>({
      path: apiConfig.endpoints.news,
      method: "POST",
      body: payload,
      auth: true,
    });
  },
};

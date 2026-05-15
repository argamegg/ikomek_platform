import axios, { isAxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import i18n from '../i18n';

const API_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

function getCurrentLang(): string {
  const lang = i18n.language;
  if (lang.startsWith('kz') || lang === 'kk') return 'kk';
  if (lang.startsWith('en')) return 'en';
  return 'ru';
}

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    const message = error.response?.data?.message;

    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallbackMessage;
}

export type RequestPriority = 'low' | 'medium' | 'high';

export interface Category {
  id: string;
  name: string;
  name_ru: string;
  name_kz: string;
  icon: string;
  color: string;
}

export interface Request {
  id: string;
  user_id: string;
  category_id: string;
  category_name: string;
  address: string;
  latitude: number;
  longitude: number;
  place_type?: string;
  problem_type: string;
  reason: string;
  description: string;
  description_ru?: string;
  description_kz?: string;
  description_en?: string;
  source_lang?: string;
  photos: string[];
  status: 'pending' | 'in_progress' | 'closed';
  priority?: RequestPriority;
  district?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  operator_id?: string;
  operator_notes?: string;
  assigned_department?: string;
  resolution_notes?: string;
  resolution_photos: string[];
}

export interface SavedLocation {
  id: string;
  user_id: string;
  name: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export type NewsType =
  | 'Аварийные работы'
  | 'Погодные условия'
  | 'Плановые работы'
  | 'Дорожные ситуации'
  | 'Управление образования'
  | 'Мероприятия города';

export type NewsCategory =
  | 'Дороги'
  | 'Коммунальные услуги'
  | 'Транспорт'
  | 'Образование'
  | 'Погода'
  | 'Благоустройство';

export interface NewsItem {
  id: string;
  title: string;
  title_ru: string;
  title_kz: string;
  title_en?: string;
  content: string;
  content_ru: string;
  content_kz: string;
  content_en?: string;
  summary?: string;
  summary_ru?: string;
  summary_kz?: string;
  summary_en?: string;
  source_lang?: string;
  translation_status?: 'translated' | 'failed' | 'skipped' | string;
  category: NewsCategory | 'critical' | 'warning' | 'info' | string;
  types?: NewsType[] | string[];
  type?: NewsType | string;
  image?: string;
  location?: string;
  start_at?: string;
  end_at?: string;
  period_start?: string;
  period_end?: string;
  created_at: string;
  updated_at?: string;
  is_active: boolean;
}

export interface NewsListResponse {
  news: NewsItem[];
  total: number;
  page: number;
  limit: number;
}

export interface NewsTranslationPreview {
  source_lang: 'ru' | 'kk' | 'en';
  translations: {
    ru: { title: string; content: string; summary: string };
    kk: { title: string; content: string; summary: string };
    en: { title: string; content: string; summary: string };
  };
}

export interface Message {
  id: string;
  request_id: string;
  sender_type: 'user' | 'operator';
  sender_id: string;
  sender_name?: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export interface AIAssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: AIAssistantAction[];
}

export interface AIAssistantAction {
  type: 'navigate';
  label: string;
  web_path?: string | null;
  mobile_path?: string | null;
  request_id?: string | null;
}

export interface AIAssistantResponse {
  reply: string;
  configured: boolean;
  model: string;
  actions: AIAssistantAction[];
}

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  category: string;
  status: string;
  is_mine: boolean;
  title: string;
  address: string;
  created_at: string;
}

export interface UserItem {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

export interface Analytics {
  requests: { total: number; pending: number; in_progress: number; closed: number };
  categories: Record<string, number>;
  users: { total: number; citizens: number; operators: number; admins: number };
}

export interface OperatorStatsResponse {
  total_assigned: number;
  in_progress: number;
  closed: number;
  pending_queue: number;
  avg_close_days: number;
  monthly_activity: Array<{ month: string; count: number }>;
  recent_requests: Array<{
    id: string;
    address: string;
    category_name: string;
    status: Request['status'];
    created_at: string;
    updated_at: string;
  }>;
}

export interface AdminPlatformStatsResponse {
  total_requests: number;
  pending: number;
  in_progress: number;
  closed: number;
  total_users: number;
  total_operators: number;
  top_categories: Array<{ id?: string; name: string; count: number }>;
  monthly_activity: Array<{ month: string; count: number }>;
  operators_workload: Array<{
    operator_id: string;
    operator_name: string;
    in_progress: number;
    closed: number;
    total: number;
  }>;
}

export const apiService = {
  // Categories
  getCategories: () => api.get<Category[]>('/categories'),

  // Requests - Citizen
  createRequest: (data: {
    category_id: string;
    address: string;
    latitude: number;
    longitude: number;
    place_type?: string;
    problem_type: string;
    reason: string;
    description: string;
    photos?: string[];
  }) => api.post<Request>('/requests', { ...data, source_lang: getCurrentLang() }),
  getUserRequests: () => api.get<Request[]>('/requests', { params: { lang: getCurrentLang() } }),
  getAllRequests: (params?: { category?: string; status?: string }) =>
    api.get<Request[]>('/requests/all', { params: { ...params, lang: getCurrentLang() } }),
  getRequest: (id: string) => api.get<Request>(`/requests/${id}`, { params: { lang: getCurrentLang() } }),

  // Requests - Operator
  getOperatorRequests: (params?: { category?: string; status?: string; priority?: RequestPriority; district?: string }) =>
    api.get<Request[]>('/operator/requests', { params: { ...params, lang: getCurrentLang() } }),
  getOperatorMyStats: () => api.get<OperatorStatsResponse>('/operator/my-stats'),
  updateRequestOperator: (id: string, data: {
    status: string;
    resolution_notes?: string;
    operator_notes?: string;
    assigned_department?: string;
    priority?: RequestPriority;
  }) => api.put(`/operator/requests/${id}`, data),

  // Locations
  getSavedLocations: () => api.get<SavedLocation[]>('/locations'),
  createSavedLocation: (data: {
    name: string; label: string; address: string; latitude: number; longitude: number;
  }) => api.post<SavedLocation>('/locations', data),
  deleteSavedLocation: (id: string) => api.delete(`/locations/${id}`),

  // Messages
  getMessages: (requestId: string) => api.get<Message[]>(`/requests/${requestId}/messages`),
  sendMessage: (requestId: string, content: string) =>
    api.post<Message>(`/requests/${requestId}/messages`, { content }),

  // AI Assistant
  askAIAssistant: (data: { message: string; history: AIAssistantMessage[]; locale: string }) =>
    api.post<AIAssistantResponse>('/ai/assistant', {
      message: data.message,
      history: data.history.map(({ role, content }) => ({ role, content })),
      locale: data.locale,
    }),

  // News
  getNews: (params?: {
    lang?: string;
    search?: string;
    category?: string;
    type?: string;
    period?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = {
      lang: params?.lang || getCurrentLang(),
      search: params?.search,
      category: params?.category,
      type: params?.type,
      period: params?.period,
      sort: params?.sort,
      page: params?.page,
      limit: params?.limit,
    };
    return api.get<NewsListResponse>('/news', { params: queryParams });
  },
  getNewsItem: (id: string) => api.get<NewsItem>(`/news/${id}`, { params: { lang: getCurrentLang() } }),
  previewNewsTranslation: (data: { title: string; content: string; summary?: string }) =>
    api.post<NewsTranslationPreview>('/admin/news/translate-preview', data),

  // Admin - News
  createNews: (data: {
    title: string; title_ru?: string; title_kz?: string; title_en?: string;
    content: string; content_ru?: string; content_kz?: string; content_en?: string;
    summary?: string; summary_ru?: string; summary_kz?: string; summary_en?: string;
    category: string;
    types: string[];
    image?: string;
    location?: string;
    start_at?: string;
    end_at?: string;
    source_lang?: string;
    translation_status?: string;
    skip_translation?: boolean;
  }) => {
    const source_lang = getCurrentLang();
    return api.post<NewsItem>('/admin/news', {
      ...data,
      source_lang: data.source_lang || source_lang,
    });
  },
  updateNews: (id: string, data: Partial<NewsItem> & { skip_translation?: boolean }) =>
    api.put<NewsItem>(`/admin/news/${id}`, data),
  deleteNews: (id: string) => api.delete(`/admin/news/${id}`),

  // Admin - Users
  getAllUsers: () => api.get<UserItem[]>('/admin/users'),
  updateUserRole: (userId: string, role: string) =>
    api.put(`/admin/users/${userId}/role`, null, { params: { role } }),

  // Admin - Analytics
  getAnalytics: () => api.get<Analytics>('/admin/analytics'),
  getAdminPlatformStats: () => api.get<AdminPlatformStatsResponse>('/admin/platform-stats'),

  // Map
  getMapPoints: (params?: { category?: string; status?: string; my_only?: boolean }) =>
    api.get<MapPoint[]>('/map/points', { params }),

  // Seed
  seedData: () => api.post('/seed')
};

export default api;

import { apiConfig } from "../config/api";
import type {
  District,
  NotificationItem,
  RequestCategory,
  RequestReason,
  SavedLocation,
  SavedLocationInput,
  User,
  UserProfileUpdateInput,
} from "../types/platform";
import { apiClient } from "./apiClient";

export const userService = {
  getCurrentUser() {
    return apiClient<User>({
      path: apiConfig.endpoints.currentUser,
      auth: true,
    });
  },
  updateCurrentUser(payload: UserProfileUpdateInput) {
    return apiClient<User>({
      path: apiConfig.endpoints.currentUser,
      method: "PATCH",
      body: payload,
      auth: true,
    });
  },
  getSavedLocations() {
    return apiClient<SavedLocation[]>({
      path: apiConfig.endpoints.savedLocations,
      auth: true,
    });
  },
  createSavedLocation(payload: SavedLocationInput) {
    return apiClient<SavedLocation>({
      path: apiConfig.endpoints.savedLocations,
      method: "POST",
      body: payload,
      auth: true,
    });
  },
  getNotifications() {
    return apiClient<NotificationItem[]>({
      path: apiConfig.endpoints.notifications,
      auth: true,
    });
  },
  getCategories() {
    return apiClient<RequestCategory[]>({
      path: apiConfig.endpoints.requestCategories,
    });
  },
  getReasons() {
    return apiClient<RequestReason[]>({
      path: apiConfig.endpoints.requestReasons,
    });
  },
  getDistricts() {
    return apiClient<District[]>({
      path: apiConfig.endpoints.districts,
    });
  },
};

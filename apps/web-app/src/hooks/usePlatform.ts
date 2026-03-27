import { useEffect, useState } from "react";
import { authService } from "../services/authService";
import { newsService } from "../services/newsService";
import { platformService } from "../services/platformService";
import { requestService } from "../services/requestService";
import { userService } from "../services/userService";
import type {
  AuthLoginInput,
  AuthRegisterInput,
  NewsCreateInput,
  PasswordRecoveryInput,
  PlatformContextData,
  RequestCreateInput,
  RequestMessageInput,
  RequestStatusUpdateInput,
  SavedLocationInput,
  UserProfileUpdateInput,
} from "../types/platform";
import { ApiError } from "../services/apiClient";

const initialState: PlatformContextData = {
  categories: [],
  reasons: [],
  districts: [],
  news: [],
  alerts: [],
  publicRequests: [],
  currentUser: null,
  savedLocations: [],
  notifications: [],
  citizenRequests: [],
  operatorQueue: [],
  metrics: null,
  loading: true,
  isAuthenticated: false,
  error: null,
};

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected platform error";
}

export function usePlatform() {
  const [state, setState] = useState<PlatformContextData>(initialState);

  async function refreshAll() {
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const publicData = await platformService.loadPublicData();

      try {
        const privateData = await platformService.loadPrivateData();
        setState({
          ...publicData,
          ...privateData,
          loading: false,
          isAuthenticated: true,
          error: null,
        });
      } catch {
        setState({
          ...publicData,
          currentUser: null,
          savedLocations: [],
          notifications: [],
          citizenRequests: [],
          operatorQueue: [],
          metrics: null,
          loading: false,
          isAuthenticated: false,
          error: null,
        });
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: getErrorMessage(error),
      }));
    }
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  async function login(payload: AuthLoginInput) {
    await authService.login(payload);
    await refreshAll();
  }

  async function register(payload: AuthRegisterInput) {
    await authService.register(payload);
    await refreshAll();
  }

  async function recoverPassword(payload: PasswordRecoveryInput) {
    await authService.recoverPassword(payload);
  }

  async function logout() {
    await authService.logout();
    await refreshAll();
  }

  async function createRequest(payload: RequestCreateInput) {
    const request = await requestService.createRequest(payload);
    await refreshAll();
    return request;
  }

  async function updateRequestStatus(requestId: string, payload: RequestStatusUpdateInput) {
    const request = await requestService.updateStatus(requestId, payload);
    await refreshAll();
    return request;
  }

  async function sendRequestMessage(requestId: string, payload: RequestMessageInput) {
    const message = await requestService.postMessage(requestId, payload);
    await refreshAll();
    return message;
  }

  async function updateProfile(payload: UserProfileUpdateInput) {
    const user = await userService.updateCurrentUser(payload);
    await refreshAll();
    return user;
  }

  async function createSavedLocation(payload: SavedLocationInput) {
    const savedLocation = await userService.createSavedLocation(payload);
    await refreshAll();
    return savedLocation;
  }

  async function publishNews(payload: NewsCreateInput) {
    const news = await newsService.createNewsItem(payload);
    await refreshAll();
    return news;
  }

  async function getRequestById(requestId: string) {
    return requestService.getRequestById(requestId);
  }

  return {
    state,
    refreshAll,
    login,
    register,
    recoverPassword,
    logout,
    createRequest,
    updateRequestStatus,
    sendRequestMessage,
    updateProfile,
    createSavedLocation,
    publishNews,
    getRequestById,
  };
}

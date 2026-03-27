import { apiConfig } from "../config/api";
import type {
  AuthLoginInput,
  AuthRegisterInput,
  AuthResponse,
  PasswordRecoveryInput,
  User,
} from "../types/platform";
import { apiClient } from "./apiClient";
import { sessionService } from "./sessionService";

function extractToken(response: AuthResponse) {
  return response.accessToken ?? response.token ?? null;
}

export const authService = {
  async login(payload: AuthLoginInput) {
    const response = await apiClient<AuthResponse>({
      path: apiConfig.endpoints.login,
      method: "POST",
      body: payload,
    });

    const token = extractToken(response);

    if (token) {
      sessionService.setToken(token);
    }

    return response.user ?? null;
  },
  async register(payload: AuthRegisterInput) {
    const response = await apiClient<AuthResponse>({
      path: apiConfig.endpoints.register,
      method: "POST",
      body: payload,
    });

    const token = extractToken(response);

    if (token) {
      sessionService.setToken(token);
    }

    return response.user ?? null;
  },
  async recoverPassword(payload: PasswordRecoveryInput) {
    await apiClient({
      path: apiConfig.endpoints.recoverPassword,
      method: "POST",
      body: payload,
    });
  },
  async logout() {
    try {
      await apiClient({
        path: apiConfig.endpoints.logout,
        method: "POST",
        auth: true,
      });
    } finally {
      sessionService.clearToken();
    }
  },
  async fetchCurrentUser() {
    return apiClient<User>({
      path: apiConfig.endpoints.currentUser,
      auth: true,
    });
  },
};

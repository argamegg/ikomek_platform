import Constants from 'expo-constants';

export const API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.backendUrl ||
  '';

export const API_BASE_URL = `${API_URL}/api`;

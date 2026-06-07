import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { isAxiosError } from 'axios';
import Constants from 'expo-constants';
import i18n from '../i18n';
import { signOutClerkIfAvailable } from './ClerkContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || Constants.expoConfig?.extra?.backendUrl || '';
const PENDING_VERIFICATION_KEY = 'pendingVerification';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  display_name?: string;
  gender?: string;
  birth_date?: string;
  avatar_url?: string;
  role: 'citizen' | 'operator' | 'admin';
  language: string;
  has_local_password?: boolean;
  created_at: string;
}

export interface ProfileUpdateInput {
  fullName: string;
  phone?: string;
  displayName?: string;
  gender?: string;
  birthDate?: string;
  avatarUrl?: string;
}

export interface PendingVerification {
  registrationId: string;
  email: string;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
}

type LoginResult =
  | { status: 'authenticated' }
  | { status: 'verification_required'; pendingVerification: PendingVerification };

export interface ClerkLoginInput {
  token: string;
  email?: string;
  fullName?: string;
  phone?: string;
  gender?: string;
  birthDate?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  pendingVerification: PendingVerification | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginWithClerk: (payload: ClerkLoginInput) => Promise<LoginResult>;
  register: (email: string, password: string, fullName: string, phone?: string) => Promise<PendingVerification>;
  verifyEmailCode: (code: string) => Promise<void>;
  resendVerificationCode: () => Promise<PendingVerification>;
  clearPendingVerification: () => Promise<void>;
  logout: () => Promise<void>;
  setLocalPassword: (newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (payload: ProfileUpdateInput) => Promise<void>;
  updateLanguage: (language: string) => Promise<void>;
  isCitizen: boolean;
  isOperator: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Update i18n when user language changes
  useEffect(() => {
    if (user?.language) {
      i18n.changeLanguage(user.language);
    }
  }, [user?.language]);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      const storedLanguage = await AsyncStorage.getItem('language');
      const storedPendingVerification = await AsyncStorage.getItem(PENDING_VERIFICATION_KEY);
      
      if (storedLanguage) {
        i18n.changeLanguage(storedLanguage);
      }

      if (storedPendingVerification) {
        setPendingVerification(JSON.parse(storedPendingVerification));
      }
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        try {
          const response = await axios.get(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          setUser(response.data);
          i18n.changeLanguage(response.data.language || 'ru');
        } catch (error) {
          await logout();
        }
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const normalizePendingVerification = (data: any): PendingVerification => ({
    registrationId: data.registration_id,
    email: data.email,
    expiresInSeconds: Number(data.expires_in_seconds ?? 0),
    resendAvailableInSeconds: Number(data.resend_available_in_seconds ?? 0),
  });

  const persistPendingVerification = async (value: PendingVerification | null) => {
    if (value) {
      setPendingVerification(value);
      await AsyncStorage.setItem(PENDING_VERIFICATION_KEY, JSON.stringify(value));
      return;
    }

    setPendingVerification(null);
    await AsyncStorage.removeItem(PENDING_VERIFICATION_KEY);
  };

  const persistAuthenticatedUser = async (accessToken: string, userData: User) => {
    await AsyncStorage.setItem('token', accessToken);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    await AsyncStorage.setItem('language', userData.language || 'ru');
    await persistPendingVerification(null);

    setToken(accessToken);
    setUser(userData);
    i18n.changeLanguage(userData.language || 'ru');
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password
      });

      const { access_token, user: userData } = response.data;
      await persistAuthenticatedUser(access_token, userData);

      return { status: 'authenticated' as const };
    } catch (error) {
      if (isAxiosError(error) && error.response?.data?.code === 'email_not_verified') {
        const nextPendingVerification = normalizePendingVerification(error.response.data);
        await persistPendingVerification(nextPendingVerification);
        return {
          status: 'verification_required' as const,
          pendingVerification: nextPendingVerification,
        };
      }

      throw error;
    }
  };

  const loginWithClerk = async (payload: ClerkLoginInput) => {
    const response = await axios.post(`${API_URL}/api/auth/clerk`, {
      token: payload.token,
      email: payload.email,
      full_name: payload.fullName,
      phone: payload.phone,
      gender: payload.gender,
      birth_date: payload.birthDate,
      avatar_url: payload.avatarUrl,
    });

    const { access_token, user: userData } = response.data;
    await persistAuthenticatedUser(access_token, userData);

    return { status: 'authenticated' as const };
  };

  const register = async (email: string, password: string, fullName: string, phone?: string) => {
    const response = await axios.post(`${API_URL}/api/auth/register`, {
      email,
      password,
      full_name: fullName,
      phone,
      language: i18n.language || 'ru',
    });

    const nextPendingVerification = normalizePendingVerification(response.data);
    await persistPendingVerification(nextPendingVerification);
    return nextPendingVerification;
  };

  const verifyEmailCode = async (code: string) => {
    if (!pendingVerification) {
      throw new Error('No pending verification');
    }

    const response = await axios.post(`${API_URL}/api/auth/verify-email`, {
      registration_id: pendingVerification.registrationId,
      code,
    });

    const { access_token, user: userData } = response.data;
    await persistAuthenticatedUser(access_token, userData);
  };

  const resendVerificationCode = async () => {
    if (!pendingVerification) {
      throw new Error('No pending verification');
    }

    const response = await axios.post(`${API_URL}/api/auth/resend-verification`, {
      registration_id: pendingVerification.registrationId,
    });

    const nextPendingVerification = normalizePendingVerification(response.data);
    await persistPendingVerification(nextPendingVerification);
    return nextPendingVerification;
  };

  const clearPendingVerification = async () => {
    await persistPendingVerification(null);
  };

  const logout = async () => {
    await signOutClerkIfAvailable();
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem(PENDING_VERIFICATION_KEY);
    setToken(null);
    setUser(null);
    setPendingVerification(null);
  };

  const setLocalPassword = async (newPassword: string) => {
    if (!token) return;

    const response = await axios.put(
      `${API_URL}/api/auth/local-password`,
      { new_password: newPassword },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const updatedUser = response.data;
    setUser(updatedUser);
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!token) return;

    await axios.put(
      `${API_URL}/api/auth/password`,
      {
        current_password: currentPassword,
        new_password: newPassword,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  };

  const updateProfile = async (payload: ProfileUpdateInput) => {
    if (!token) return;

    const profilePayload = {
      full_name: payload.fullName,
      phone: payload.phone,
      display_name: payload.displayName,
      gender: payload.gender,
      birth_date: payload.birthDate,
      avatar_url: payload.avatarUrl,
    };
    
    await axios.put(
      `${API_URL}/api/auth/profile`,
      profilePayload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const response = await axios.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    setUser(response.data);
    await AsyncStorage.setItem('user', JSON.stringify(response.data));
  };

  const updateLanguage = async (language: string) => {
    if (!token) return;
    
    try {
      await axios.put(
        `${API_URL}/api/auth/language`,
        { language },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (user) {
        const updatedUser = { ...user, language };
        setUser(updatedUser);
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        await AsyncStorage.setItem('language', language);
        i18n.changeLanguage(language);
      }
    } catch (error) {
      console.error('Error updating language:', error);
    }
  };

  const isCitizen = Boolean(user) && (user?.role === 'citizen' || !user?.role);
  const isOperator = user?.role === 'operator';
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        pendingVerification,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        loginWithClerk,
        register,
        verifyEmailCode,
        resendVerificationCode,
        clearPendingVerification,
        logout,
        setLocalPassword,
        changePassword,
        updateProfile,
        updateLanguage,
        isCitizen,
        isOperator,
        isAdmin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

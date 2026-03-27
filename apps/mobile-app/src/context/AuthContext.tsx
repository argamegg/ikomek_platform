import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import i18n from '../i18n';

const API_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'citizen' | 'operator' | 'admin';
  language: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (fullName?: string, phone?: string) => Promise<void>;
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
      
      if (storedLanguage) {
        i18n.changeLanguage(storedLanguage);
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

  const login = async (email: string, password: string) => {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password
    });
    
    const { access_token, user: userData } = response.data;
    
    await AsyncStorage.setItem('token', access_token);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    await AsyncStorage.setItem('language', userData.language || 'ru');
    
    setToken(access_token);
    setUser(userData);
    i18n.changeLanguage(userData.language || 'ru');
  };

  const register = async (email: string, password: string, fullName: string, phone?: string) => {
    const response = await axios.post(`${API_URL}/api/auth/register`, {
      email,
      password,
      full_name: fullName,
      phone
    });

    if (response.data?.status === 'verification_required') {
      throw new Error('A verification code was sent to your email. Verify your account before signing in.');
    }
    
    const { access_token, user: userData } = response.data;
    
    await AsyncStorage.setItem('token', access_token);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    await AsyncStorage.setItem('language', userData.language || 'ru');
    
    setToken(access_token);
    setUser(userData);
    i18n.changeLanguage(userData.language || 'ru');
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (fullName?: string, phone?: string) => {
    if (!token) return;
    
    await axios.put(
      `${API_URL}/api/auth/profile`,
      { full_name: fullName, phone },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (user) {
      const updatedUser = {
        ...user,
        full_name: fullName || user.full_name,
        phone: phone || user.phone
      };
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    }
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

  const isCitizen = user?.role === 'citizen' || !user?.role;
  const isOperator = user?.role === 'operator';
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
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

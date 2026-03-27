import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/context/AuthContext';
import { getAuthErrorMessage } from '../../src/utils/authErrors';

const ORANGE = '#FF6B00';

function getRedirectPath(role?: string) {
  switch (role) {
    case 'operator': return '/(operator)/dashboard';
    case 'admin': return '/(admin)/analytics';
    default: return '/(tabs)/';
  }
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { login, user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user?.role) {
      router.replace(getRedirectPath(user.role) as any);
    }
  }, [isAuthenticated, router, user]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('auth.enterAllFields'));
      return;
    }
    setIsLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.status === 'verification_required') {
        router.replace('/(auth)/verify');
        return;
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), getAuthErrorMessage(error, t));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}><Text style={styles.logoText}>109</Text></View>
          <Text style={styles.title}>{t('auth.signInTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.signInSubtitle')}</Text>
        </View>
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder={t('auth.email')} placeholderTextColor="#C7C7CC" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} data-testid="login-email-input" />
          </View>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder={t('auth.password')} placeholderTextColor="#C7C7CC" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} data-testid="login-password-input" />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleLogin} disabled={isLoading} data-testid="login-submit-btn">
            {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>{t('auth.signIn')}</Text>}
          </TouchableOpacity>
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.noAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}><Text style={styles.footerLink}>{t('auth.signUp')}</Text></TouchableOpacity>
          </View>
          <View style={styles.demoSection}>
            <Text style={styles.demoSectionTitle}>{t('auth.demoAccounts')}</Text>
            <TouchableOpacity style={styles.demoCard} onPress={() => { setEmail('demo@ikomek.kz'); setPassword('demo123'); }}>
              <View style={[styles.roleDot, { backgroundColor: '#34C759' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.demoRole}>{t('auth.citizen')}</Text>
                <Text style={styles.demoEmail}>demo@ikomek.kz</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.demoCard} onPress={() => { setEmail('operator@ikomek.kz'); setPassword('operator123'); }}>
              <View style={[styles.roleDot, { backgroundColor: '#007AFF' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.demoRole}>{t('auth.operator')}</Text>
                <Text style={styles.demoEmail}>operator@ikomek.kz</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.demoCard} onPress={() => { setEmail('admin@ikomek.kz'); setPassword('admin123'); }}>
              <View style={[styles.roleDot, { backgroundColor: '#FF3B30' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.demoRole}>{t('auth.admin')}</Text>
                <Text style={styles.demoEmail}>admin@ikomek.kz</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  scrollContent: { flexGrow: 1, padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 80, height: 80, borderRadius: 20, backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  logoText: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#8E8E93' },
  form: { flex: 1 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, height: 56 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1C1C1E' },
  button: { backgroundColor: ORANGE, borderRadius: 12, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#8E8E93', fontSize: 15 },
  footerLink: { color: ORANGE, fontSize: 15, fontWeight: '600' },
  demoSection: { marginTop: 32, backgroundColor: '#F2F2F7', borderRadius: 16, padding: 16 },
  demoSectionTitle: { fontSize: 14, fontWeight: '600', color: '#8E8E93', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  demoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginBottom: 8, gap: 10 },
  roleDot: { width: 10, height: 10, borderRadius: 5 },
  demoRole: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  demoEmail: { fontSize: 12, color: '#8E8E93' }
});

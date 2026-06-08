import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/context/AuthContext';
import { getClerkExpoModule, isClerkConfigured } from '../../src/context/ClerkContext';
import { getAuthErrorMessage } from '../../src/utils/authErrors';

const ORANGE = '#FF6B00';

WebBrowser.maybeCompleteAuthSession();

function getRedirectPath(role?: string) {
  switch (role) {
    case 'operator': return '/(operator)/dashboard';
    case 'admin': return '/(admin)/analytics';
    default: return '/(tabs)/';
  }
}

function getClerkMetadataString(clerkUser: any, keys: string[]) {
  const metadata = {
    ...(clerkUser?.publicMetadata || {}),
    ...(clerkUser?.unsafeMetadata || {}),
  };

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function getClerkLoginErrorMessage(error: any, t: ReturnType<typeof useTranslation>['t']) {
  const clerkError = error?.errors?.[0];
  const clerkMessage = clerkError?.longMessage || clerkError?.message;

  if (typeof clerkMessage === 'string' && clerkMessage.trim()) {
    return clerkMessage.trim();
  }

  if (error instanceof Error && error.message && error.message !== '[object Object]') {
    return error.message;
  }

  return getAuthErrorMessage(error, t);
}

function GoogleLoginArea() {
  const { t } = useTranslation();

  if (!isClerkConfigured) {
    return (
      <TouchableOpacity
        style={styles.googleButton}
        onPress={() => Alert.alert(t('common.error'), t('auth.googleSignInUnavailable'))}
      >
        <View style={styles.googleIconCircle}>
          <FontAwesome name="google" size={16} color="#4285F4" />
        </View>
        <Text style={styles.googleButtonText}>{t('auth.signInWithGoogle')}</Text>
      </TouchableOpacity>
    );
  }

  const clerkExpo = getClerkExpoModule();

  if (!clerkExpo) {
    return (
      <TouchableOpacity
        style={styles.googleButton}
        onPress={() => Alert.alert(t('common.error'), t('auth.googleNativeModuleUnavailable'))}
      >
        <View style={styles.googleIconCircle}>
          <FontAwesome name="google" size={16} color="#4285F4" />
        </View>
        <Text style={styles.googleButtonText}>{t('auth.signInWithGoogle')}</Text>
      </TouchableOpacity>
    );
  }

  return <GoogleSignInButton clerkExpo={clerkExpo} />;
}

function GoogleSignInButton({ clerkExpo }: { clerkExpo: NonNullable<ReturnType<typeof getClerkExpoModule>> }) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { t } = useTranslation();
  const { loginWithClerk } = useAuth();
  const { useAuth: useClerkAuth, useSSO, useUser } = clerkExpo;
  const { getToken, isLoaded: isClerkLoaded, isSignedIn } = useClerkAuth();
  const { startSSOFlow } = useSSO();
  const { user: clerkUser } = useUser();

  const getCurrentClerkToken = async () => {
    const hookToken = await getToken();
    if (hookToken) {
      return hookToken;
    }

    try {
      const clerk = clerkExpo.getClerkInstance();
      return await clerk.session?.getToken();
    } catch {
      return null;
    }
  };

  const syncClerkUser = async () => {
    const clerkToken = await getCurrentClerkToken();

    if (!clerkToken) {
      throw new Error(t('auth.googleMissingToken'));
    }

    await loginWithClerk({
      token: clerkToken,
      email: clerkUser?.primaryEmailAddress?.emailAddress,
      fullName: clerkUser?.fullName ?? clerkUser?.username ?? undefined,
      phone: clerkUser?.primaryPhoneNumber?.phoneNumber,
      gender: getClerkMetadataString(clerkUser, ['gender', 'sex']),
      birthDate: getClerkMetadataString(clerkUser, ['birthDate', 'birth_date', 'birthday', 'date_of_birth']),
      avatarUrl: clerkUser?.imageUrl,
    });
  };

  const handleGoogleLogin = async () => {
    if (isGoogleLoading || !isClerkLoaded) return;

    setIsGoogleLoading(true);
    try {
      if (isSignedIn) {
        await syncClerkUser();
        return;
      }

      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
      });

      if (!createdSessionId) {
        return;
      }

      await setActive?.({ session: createdSessionId });
      await syncClerkUser();
    } catch (error: any) {
      Alert.alert(t('common.error'), getClerkLoginErrorMessage(error, t));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.googleButton, (isGoogleLoading || !isClerkLoaded) && styles.buttonDisabled]}
      onPress={handleGoogleLogin}
      disabled={isGoogleLoading || !isClerkLoaded}
      data-testid="login-google-btn"
    >
      {isGoogleLoading || !isClerkLoaded ? (
        <ActivityIndicator color="#111827" />
      ) : (
        <>
          <View style={styles.googleIconCircle}>
            <FontAwesome name="google" size={16} color="#4285F4" />
          </View>
          <Text style={styles.googleButtonText}>{t('auth.signInWithGoogle')}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localPassword, setLocalPasswordValue] = useState('');
  const [localPasswordConfirm, setLocalPasswordConfirm] = useState('');
  const [showLocalPassword, setShowLocalPassword] = useState(false);
  const [isLocalPasswordLoading, setIsLocalPasswordLoading] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { login, setLocalPassword, user, isAuthenticated } = useAuth();
  const needsLocalPassword = isAuthenticated && user?.has_local_password === false;

  useEffect(() => {
    if (isAuthenticated && user?.role && !needsLocalPassword) {
      router.replace(getRedirectPath(user.role) as any);
    }
  }, [isAuthenticated, needsLocalPassword, router, user]);

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

  const handleSetLocalPassword = async () => {
    if (!localPassword.trim() || !localPasswordConfirm.trim()) {
      Alert.alert(t('common.error'), t('auth.localPasswordFillAll'));
      return;
    }

    if (localPassword.length < 6) {
      Alert.alert(t('common.error'), t('auth.localPasswordMin'));
      return;
    }

    if (localPassword !== localPasswordConfirm) {
      Alert.alert(t('common.error'), t('auth.localPasswordMismatch'));
      return;
    }

    setIsLocalPasswordLoading(true);
    try {
      await setLocalPassword(localPassword);
      setLocalPasswordValue('');
      setLocalPasswordConfirm('');
      Alert.alert(t('common.success'), t('auth.localPasswordSaved'));
    } catch (error: any) {
      Alert.alert(t('common.error'), getAuthErrorMessage(error, t));
    } finally {
      setIsLocalPasswordLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoFrame}>
            <Image
              source={require('../../assets/images/app-icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
              accessibilityLabel="iKOMEK 109"
            />
          </View>
          <Text style={styles.title}>{t('auth.signInTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.signInSubtitle')}</Text>
        </View>
        <View style={styles.form}>
          {needsLocalPassword ? (
            <View style={styles.localPasswordCard}>
              <View style={styles.localPasswordHeader}>
                <View style={styles.localPasswordAvatar}>
                  {user?.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={styles.localPasswordAvatarImage} />
                  ) : (
                    <Text style={styles.localPasswordAvatarText}>{user?.full_name?.trim()?.[0] || 'I'}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.localPasswordTitle}>{t('auth.localPasswordTitle')}</Text>
                  <Text style={styles.localPasswordHint}>{t('auth.localPasswordHint')}</Text>
                </View>
              </View>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.localPassword')}
                  placeholderTextColor="#C7C7CC"
                  value={localPassword}
                  onChangeText={setLocalPasswordValue}
                  secureTextEntry={!showLocalPassword}
                  autoComplete="new-password"
                  data-testid="local-password-input"
                />
                <TouchableOpacity onPress={() => setShowLocalPassword(!showLocalPassword)}>
                  <Ionicons name={showLocalPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.localPasswordConfirm')}
                  placeholderTextColor="#C7C7CC"
                  value={localPasswordConfirm}
                  onChangeText={setLocalPasswordConfirm}
                  secureTextEntry={!showLocalPassword}
                  autoComplete="new-password"
                  data-testid="local-password-confirm-input"
                />
              </View>
              <TouchableOpacity
                style={[styles.button, isLocalPasswordLoading && styles.buttonDisabled]}
                onPress={handleSetLocalPassword}
                disabled={isLocalPasswordLoading}
                data-testid="local-password-submit-btn"
              >
                {isLocalPasswordLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>{t('auth.localPasswordSave')}</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
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
              <GoogleLoginArea />
              <View style={styles.demoSection}>
                <Text style={styles.demoSectionTitle}>{t('auth.demoAccounts')}</Text>
                <TouchableOpacity style={styles.demoCard} onPress={() => { setEmail('demo@ikomek.kz'); setPassword('demo123'); }}>
                  <View style={[styles.roleDot, { backgroundColor: '#34C759' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.demoRole}>{t('auth.citizen')}</Text>
                    <Text style={styles.demoEmail}>demo@ikomek.kz</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.demoCard} onPress={() => { setEmail('operator@ikomek.kz'); setPassword(''); }}>
                  <View style={[styles.roleDot, { backgroundColor: '#007AFF' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.demoRole}>{t('auth.operator')}</Text>
                    <Text style={styles.demoEmail}>operator@ikomek.kz</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.demoCard} onPress={() => { setEmail('admin@ikomek.kz'); setPassword(''); }}>
                  <View style={[styles.roleDot, { backgroundColor: '#FF3B30' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.demoRole}>{t('auth.admin')}</Text>
                    <Text style={styles.demoEmail}>admin@ikomek.kz</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1, padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoFrame: { width: 144, height: 108, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoImage: { width: 176, height: 176 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#475569', fontWeight: '500' },
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
  localPasswordCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D1F5DD',
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  localPasswordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  localPasswordAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EAF8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  localPasswordAvatarImage: { width: 48, height: 48 },
  localPasswordAvatarText: { fontSize: 18, fontWeight: '800', color: '#166534' },
  localPasswordTitle: { color: '#111827', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  localPasswordHint: { color: '#64748B', fontSize: 14, lineHeight: 20 },
  googleButton: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  googleIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  googleButtonText: { color: '#111827', fontSize: 16, fontWeight: '700' },
  demoSection: { marginTop: 32, backgroundColor: '#F2F2F7', borderRadius: 16, padding: 16 },
  demoSectionTitle: { fontSize: 14, fontWeight: '600', color: '#8E8E93', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  demoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginBottom: 8, gap: 10 },
  roleDot: { width: 10, height: 10, borderRadius: 5 },
  demoRole: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  demoEmail: { fontSize: 12, color: '#8E8E93' }
});

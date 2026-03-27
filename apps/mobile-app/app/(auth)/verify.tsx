import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/context/AuthContext';
import { getAuthErrorMessage } from '../../src/utils/authErrors';

const ORANGE = '#FF6B00';

export default function VerifyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    pendingVerification,
    verifyEmailCode,
    resendVerificationCode,
    clearPendingVerification,
  } = useAuth();

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    setResendCountdown(Math.max(0, pendingVerification?.resendAvailableInSeconds ?? 0));
  }, [pendingVerification?.registrationId, pendingVerification?.resendAvailableInSeconds]);

  useEffect(() => {
    if (resendCountdown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendCountdown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCountdown]);

  const handleVerify = async () => {
    if (!code.trim()) {
      Alert.alert(t('common.error'), t('auth.codeRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyEmailCode(code.trim());
    } catch (error: any) {
      Alert.alert(t('common.error'), getAuthErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) {
      return;
    }

    setIsResending(true);
    try {
      const nextPendingVerification = await resendVerificationCode();
      setResendCountdown(Math.max(0, nextPendingVerification.resendAvailableInSeconds));
      Alert.alert(t('common.success'), t('auth.resendSuccess'));
    } catch (error: any) {
      Alert.alert(t('common.error'), getAuthErrorMessage(error, t));
    } finally {
      setIsResending(false);
    }
  };

  const handleChangeEmail = async () => {
    await clearPendingVerification();
    router.replace('/(auth)/register');
  };

  if (!pendingVerification) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, styles.centeredContent, { paddingTop: insets.top + 24 }]}
        >
          <View style={styles.emptyState}>
            <Text style={styles.title}>{t('auth.noPendingVerificationTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.noPendingVerificationSubtitle')}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(auth)/register')}>
              <Text style={styles.primaryButtonText}>{t('auth.returnToRegister')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.secondaryButtonText}>{t('auth.signIn')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, styles.centeredContent, { paddingTop: insets.top + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="mail-open-outline" size={30} color={ORANGE} />
          </View>

          <Text style={styles.eyebrow}>{t('auth.verificationEyebrow')}</Text>
          <Text style={styles.title}>{t('auth.verifyTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.verificationSent', { email: pendingVerification.email })}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.verificationCode')}</Text>
            <TextInput
              style={styles.codeInput}
              placeholder={t('auth.verificationCodePlaceholder')}
              placeholderTextColor="#C7C7CC"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              value={code}
              onChangeText={(value) => setCode(value.replace(/[^\d]/g, '').slice(0, 6))}
              maxLength={6}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('auth.verifyButton')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, (isResending || resendCountdown > 0) && styles.buttonDisabled]}
            onPress={handleResend}
            disabled={isResending || resendCountdown > 0}
          >
            {isResending ? (
              <ActivityIndicator color={ORANGE} />
            ) : (
              <Text style={styles.secondaryButtonText}>
                {resendCountdown > 0
                  ? t('auth.resendIn', { seconds: resendCountdown })
                  : t('auth.resendCode')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleChangeEmail} style={styles.linkButton}>
            <Text style={styles.linkText}>{t('auth.changeEmail')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  centeredContent: {
    justifyContent: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F2F2F7',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  emptyState: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#FFF3EB',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: ORANGE,
    textAlign: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  codeInput: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 18,
    fontSize: 24,
    letterSpacing: 8,
    color: '#1C1C1E',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD8BF',
    backgroundColor: '#FFF8F3',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: ORANGE,
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 18,
    alignSelf: 'center',
    paddingVertical: 6,
  },
  linkText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

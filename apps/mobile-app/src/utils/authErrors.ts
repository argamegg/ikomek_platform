import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { API_URL } from './apiConfig';

export function getAuthErrorMessage(error: unknown, t: TFunction): string {
  if (!isAxiosError(error)) {
    return t('errors.tryAgain');
  }

  const data = error.response?.data ?? {};
  const detail = typeof data.detail === 'string' ? data.detail : '';
  const code = typeof data.code === 'string' ? data.code : '';

  if (!error.response) {
    const apiLabel = API_URL || 'not configured';
    const errorLabel = error.code || error.message;
    return `${t('errors.backendUnavailable')}\nAPI: ${apiLabel}${errorLabel ? `\n${errorLabel}` : ''}`;
  }

  if (code === 'email_not_verified') {
    return t('auth.emailNotVerified');
  }

  if (detail.startsWith('Please wait ')) {
    const seconds = Number(detail.match(/\d+/)?.[0] ?? 0);
    return t('auth.resendIn', { seconds });
  }

  switch (detail) {
    case 'Invalid credentials':
      return t('auth.invalidCredentials');
    case 'Email already registered':
      return t('auth.emailAlreadyRegistered');
    case 'Unable to send verification email':
      return t('auth.unableToSendVerification');
    case 'Verification session not found':
      return t('auth.noPendingVerificationSubtitle');
    case 'Code expired':
      return t('auth.codeExpired');
    case 'Invalid code':
      return t('auth.invalidCode');
    case 'Too many verification attempts. Request a new code.':
      return t('auth.tooManyAttempts');
    case 'Your account is not verified yet':
      return t('auth.emailNotVerified');
    default:
      return detail || t('errors.tryAgain');
  }
}

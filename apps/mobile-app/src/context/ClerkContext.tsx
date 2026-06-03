import React, { ReactNode } from 'react';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';

type ClerkExpoModule = typeof import('@clerk/expo');

let clerkExpoModule: ClerkExpoModule | null | undefined;

const publishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  Constants.expoConfig?.extra?.clerkPublishableKey ||
  '';

export const isClerkConfigured = Boolean(publishableKey.trim());

export function getClerkExpoModule() {
  if (clerkExpoModule !== undefined) {
    return clerkExpoModule;
  }

  const secureStoreModule = requireOptionalNativeModule('ExpoSecureStore');
  if (!secureStoreModule) {
    clerkExpoModule = null;
    return clerkExpoModule;
  }

  try {
    // Lazy load so an older dev build without ExpoSecureStore does not break routing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    clerkExpoModule = require('@clerk/expo') as ClerkExpoModule;
  } catch {
    clerkExpoModule = null;
  }

  return clerkExpoModule;
}

export async function signOutClerkIfAvailable() {
  if (!isClerkConfigured) {
    return;
  }

  const clerkExpo = getClerkExpoModule();
  if (!clerkExpo?.getClerkInstance) {
    return;
  }

  try {
    const clerk = clerkExpo.getClerkInstance({ publishableKey });
    await clerk.signOut();
  } catch {
    // Local app logout should still complete if Clerk is unavailable.
  }
}

export function OptionalClerkProvider({ children }: { children: ReactNode }) {
  if (!isClerkConfigured) {
    return <>{children}</>;
  }

  const clerkExpo = getClerkExpoModule();

  if (!clerkExpo?.ClerkProvider) {
    return <>{children}</>;
  }

  const { ClerkProvider } = clerkExpo;

  return (
    <ClerkProvider publishableKey={publishableKey}>
      {children}
    </ClerkProvider>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Animated, Easing, StyleSheet } from 'react-native';
import { AppBackground } from '../src/components/AppBackground';
import { AIAssistantProvider } from '../src/components/AIAssistantWidget';
import { SplashVideo } from '../src/components/SplashVideo';
import '../src/i18n';

const SPLASH_ORANGE = '#FB8C00';

void SplashScreen.preventAutoHideAsync().catch(() => {});

function getRedirectPath(role?: string) {
  switch (role) {
    case 'operator':
      return '/(operator)/dashboard';
    case 'admin':
      return '/(admin)/analytics';
    default:
      return '/(tabs)/';
  }
}

function RootLayoutContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [isJsReady, setIsJsReady] = useState(false);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [videoFinished, setVideoFinished] = useState(false);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const dataLoaded = !isLoading;
  const transitionReady = nativeSplashHidden && videoFinished && dataLoaded;
  const shouldShowSpinner = nativeSplashHidden && videoFinished && !dataLoaded && !splashDismissed;

  useEffect(() => {
    if (isLoading) return;

    const currentGroup = segments[0];
    const inAuthGroup = currentGroup === '(auth)';

    if (!isAuthenticated || !user) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
      return;
    }

    if (inAuthGroup) {
      router.replace(getRedirectPath(user.role) as any);
    }
  }, [isAuthenticated, isLoading, router, segments, user]);

  useEffect(() => {
    setIsJsReady(true);
  }, []);

  useEffect(() => {
    if (!isJsReady || nativeSplashHidden) {
      return;
    }

    let isMounted = true;

    const hideNativeSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } finally {
        if (isMounted) {
          setNativeSplashHidden(true);
        }
      }
    };

    void hideNativeSplash();

    return () => {
      isMounted = false;
    };
  }, [isJsReady, nativeSplashHidden]);

  useEffect(() => {
    if (!transitionReady || splashDismissed) {
      return;
    }

    Animated.parallel([
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setSplashDismissed(true);
      }
    });
  }, [contentOpacity, splashDismissed, splashOpacity, transitionReady]);

  const splashContent = useMemo(() => {
    if (!nativeSplashHidden) {
      return <View style={styles.loading} />;
    }

    if (shouldShowSpinner) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={SPLASH_ORANGE} />
        </View>
      );
    }

    return <SplashVideo onFinish={() => setVideoFinished(true)} />;
  }, [nativeSplashHidden, shouldShowSpinner]);

  return (
    <>
      <StatusBar style="dark" />
      <AIAssistantProvider>
        <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(operator)" options={{ headerShown: false }} />
            <Stack.Screen name="(admin)" options={{ headerShown: false }} />
            <Stack.Screen name="request" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
          </Stack>
        </Animated.View>
      </AIAssistantProvider>
      {!splashDismissed ? (
        <Animated.View style={[styles.splashOverlay, { opacity: splashOpacity }]}>
          {splashContent}
        </Animated.View>
      ) : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppBackground>
            <RootLayoutContent />
          </AppBackground>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
});

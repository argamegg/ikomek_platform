import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type KeyboardEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type Href, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { apiService, AIAssistantAction, AIAssistantMessage, getApiErrorMessage } from '../utils/api';

const ORANGE = '#FF6B00';
const ASSISTANT_ROUTES = new Set(['/settings']);

const MOBILE_ROUTE_ALIASES: Record<string, Href> = {
  '/': '/(tabs)',
  '/news': '/(tabs)',
  '/dashboard': '/(tabs)/profile',
  '/requests': '/(tabs)/requests',
  '/requests/new': '/(tabs)/create',
  '/map': '/(tabs)/map',
  '/profile': '/(tabs)/profile',
  '/settings': '/settings',
  '/auth': '/(auth)/login',
  '/operator': '/(operator)/dashboard',
  '/admin': '/(admin)/analytics',
  '/(tabs)': '/(tabs)',
  '/(tabs)/settings': '/settings',
  '/(tabs)/requests': '/(tabs)/requests',
  '/(tabs)/create': '/(tabs)/create',
  '/(tabs)/map': '/(tabs)/map',
  '/(tabs)/profile': '/(tabs)/profile',
  '/(auth)/login': '/(auth)/login',
  '/(operator)': '/(operator)/dashboard',
  '/(admin)': '/(admin)/analytics',
};

type AIAssistantContextValue = {
  openAssistant: () => void;
};

const AIAssistantContext = createContext<AIAssistantContextValue | null>(null);

const COPY = {
  ru: {
    title: 'AI ассистент',
    subtitle: 'Помощник iKOMEK 109',
    greeting: 'Здравствуйте! Я помогу разобраться с заявками, статусами, новостями и разделами приложения.',
    placeholder: 'Напишите вопрос...',
    error: 'Не удалось получить ответ. Проверьте backend и настройки AI.',
    unconfigured: 'Gemini API key не настроен',
  },
  kz: {
    title: 'AI ассистент',
    subtitle: 'iKOMEK 109 көмекшісі',
    greeting: 'Сәлеметсіз бе! Мен өтінімдер, мәртебелер, жаңалықтар және қосымша бөлімдері бойынша көмектесемін.',
    placeholder: 'Сұрағыңызды жазыңыз...',
    error: 'Жауап алу мүмкін болмады. Backend және AI баптауларын тексеріңіз.',
    unconfigured: 'Gemini API key бапталмаған',
  },
  en: {
    title: 'AI assistant',
    subtitle: 'iKOMEK 109 helper',
    greeting: 'Hi! I can help with requests, statuses, news, and app navigation.',
    placeholder: 'Ask a question...',
    error: 'Could not get an answer. Check the backend and AI settings.',
    unconfigured: 'Gemini API key is not configured',
  },
};

function getLocale(language: string): 'ru' | 'kz' | 'en' {
  if (language.startsWith('kz') || language.startsWith('kk')) return 'kz';
  if (language.startsWith('en')) return 'en';
  return 'ru';
}

export function useAIAssistant() {
  const context = useContext(AIAssistantContext);
  if (!context) {
    return { openAssistant: () => {} };
  }
  return context;
}

export function AIAssistantHeaderButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { openAssistant } = useAIAssistant();
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user || !ASSISTANT_ROUTES.has(pathname)) {
    return null;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      accessibilityRole="button"
      accessibilityLabel="109"
      style={[styles.headerToggle, style]}
      onPress={openAssistant}
    >
      <Ionicons name="chatbubble-ellipses-outline" size={20} color={ORANGE} />
    </TouchableOpacity>
  );
}

export function AIAssistantProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const locale = getLocale(i18n.language);
  const copy = COPY[locale];
  const [panelVisible, setPanelVisible] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const openProgress = useRef(new Animated.Value(0)).current;
  const [messages, setMessages] = useState<AIAssistantMessage[]>([
    { role: 'assistant', content: copy.greeting },
  ]);
  const scrollRef = useRef<ScrollView | null>(null);
  const panelWidth = Math.min(width - 28, 380);
  const basePanelTop = insets.top + 58;
  const defaultPanelHeight = Math.min(Math.round(height * 0.6), 480);
  const keyboardGap = keyboardHeight > 0 ? 12 : 0;
  const availableHeight = height - basePanelTop - keyboardHeight - keyboardGap;
  const panelHeight = Math.max(240, Math.min(defaultPanelHeight, availableHeight));
  const panelTop =
    keyboardHeight > 0 && availableHeight < 240
      ? Math.max(insets.top + 8, height - keyboardHeight - keyboardGap - 240)
      : basePanelTop;
  const translateX = openProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [panelWidth / 2, 0],
  });
  const translateY = openProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-panelHeight / 2, 0],
  });
  const showAssistant = Boolean(user) && ASSISTANT_ROUTES.has(pathname);

  const closeAssistant = useCallback(() => {
    Animated.timing(openProgress, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setPanelVisible(false);
      }
    });
  }, [openProgress]);

  const openAssistant = useCallback(() => {
    if (!showAssistant) return;

    setPanelVisible(true);
    requestAnimationFrame(() => {
      Animated.timing(openProgress, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [openProgress, showAssistant]);

  useEffect(() => {
    if (!showAssistant && panelVisible) {
      closeAssistant();
    }
  }, [closeAssistant, panelVisible, showAssistant]);

  useEffect(() => {
    const handleKeyboardChange = (event: KeyboardEvent) => {
      const coordinates = event.endCoordinates;
      const screenY = coordinates?.screenY;
      const heightFromScreenY =
        typeof screenY === 'number' && screenY > 0 && screenY < height ? Math.max(0, height - screenY) : 0;
      const nextHeight = heightFromScreenY || coordinates?.height || 0;
      setKeyboardHeight(nextHeight);
    };
    const handleKeyboardHide = () => setKeyboardHeight(0);
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardChange);
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [height]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0].role !== 'assistant') return current;
      return [{ role: 'assistant', content: copy.greeting }];
    });
  }, [copy.greeting]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages, panelVisible]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const history = messages.slice(-8);
    setMessages((current) => [...current, { role: 'user', content: text }]);
    setInput('');
    setIsSending(true);

    try {
      const response = await apiService.askAIAssistant({
        message: text,
        history,
        locale,
      });
      setConfigured(response.data.configured);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: response.data.reply, actions: response.data.actions ?? [] },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: getApiErrorMessage(error, copy.error),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const resolveActionPath = (action: AIAssistantAction): Href | null => {
    const rawPath = action.mobile_path || action.web_path;
    if (!rawPath) return null;

    if (action.request_id || /^\/requests\/[^/]+/.test(rawPath)) {
      return '/(tabs)/requests';
    }

    return MOBILE_ROUTE_ALIASES[rawPath] ?? (rawPath as Href);
  };

  const handleActionPress = (action: AIAssistantAction) => {
    const path = resolveActionPath(action);
    if (!path) return;
    router.push(path);
    closeAssistant();
  };

  return (
    <AIAssistantContext.Provider value={{ openAssistant }}>
      {children}
      {showAssistant ? (
        <View pointerEvents="box-none" style={styles.root}>
          {panelVisible ? (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              pointerEvents="box-none"
              style={styles.panelLayer}
            >
              <Pressable style={StyleSheet.absoluteFill} onPress={closeAssistant}>
                <Animated.View style={[styles.backdrop, { opacity: openProgress }]} />
              </Pressable>
              <Animated.View
                style={[
                  styles.panel,
                  {
                    top: panelTop,
                    right: 14,
                    width: panelWidth,
                    height: panelHeight,
                    opacity: openProgress,
                    transform: [
                      { translateX },
                      { translateY },
                      { scale: openProgress.interpolate({ inputRange: [0, 1], outputRange: [0.18, 1] }) },
                    ],
                  },
                ]}
              >
                <View style={styles.header}>
                  <View style={styles.avatar}>
                    <Ionicons name="sparkles-outline" size={20} color={ORANGE} />
                  </View>
                  <View style={styles.headerCopy}>
                    <Text style={styles.title}>{copy.title}</Text>
                    <Text style={styles.subtitle}>{configured ? copy.subtitle : copy.unconfigured}</Text>
                  </View>
                  <TouchableOpacity style={styles.iconButton} onPress={closeAssistant}>
                    <Ionicons name="close" size={20} color="#475569" />
                  </TouchableOpacity>
                </View>

              <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent}>
                {messages.map((message, index) => (
                  <View
                    key={`${message.role}-${index}`}
                    style={[
                      styles.message,
                      message.role === 'user' ? styles.userMessage : styles.assistantMessage,
                    ]}
                  >
                    <Text style={styles.messageText}>{message.content}</Text>
                    {message.actions?.length ? (
                      <View style={styles.actionsRow}>
                        {message.actions.map((action, actionIndex) => {
                          const actionPath = resolveActionPath(action);
                          return (
                            <TouchableOpacity
                              key={`${action.label}-${actionIndex}`}
                              activeOpacity={0.82}
                              disabled={!actionPath}
                              style={[styles.actionButton, !actionPath && styles.actionButtonDisabled]}
                              onPress={() => handleActionPress(action)}
                            >
                              <Text style={styles.actionButtonText}>{action.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                ))}
                {isSending ? (
                  <View style={[styles.message, styles.assistantMessage, styles.loadingMessage]}>
                    <ActivityIndicator size="small" color={ORANGE} />
                  </View>
                ) : null}
              </ScrollView>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder={copy.placeholder}
                  placeholderTextColor="#94A3B8"
                  multiline
                />
                <TouchableOpacity
                  style={[styles.sendButton, (!input.trim() || isSending) && styles.sendButtonDisabled]}
                  onPress={sendMessage}
                  disabled={!input.trim() || isSending}
                >
                  <Ionicons name="send" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        ) : null}
        </View>
      ) : null}
    </AIAssistantContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  headerToggle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  panelLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.12)',
  },
  panel: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.16,
    shadowRadius: 34,
    elevation: 8,
  },
  header: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,0,0.12)',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: 14,
    gap: 10,
  },
  message: {
    maxWidth: '86%',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 18,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  userMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 6,
    backgroundColor: 'rgba(255,107,0,0.18)',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#0F172A',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.22)',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingMessage: {
    width: 48,
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.08)',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 92,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontSize: 15,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});

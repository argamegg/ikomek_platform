import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { apiService, AIAssistantMessage, getApiErrorMessage } from '../utils/api';

const ORANGE = '#FF6B00';

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
  const insets = useSafeAreaInsets();
  const locale = getLocale(i18n.language);
  const copy = COPY[locale];
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [messages, setMessages] = useState<AIAssistantMessage[]>([
    { role: 'assistant', content: copy.greeting },
  ]);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0].role !== 'assistant') return current;
      return [{ role: 'assistant', content: copy.greeting }];
    });
  }, [copy.greeting]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages, isOpen]);

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
      setMessages((current) => [...current, { role: 'assistant', content: response.data.reply }]);
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

  return (
    <AIAssistantContext.Provider value={{ openAssistant: () => setIsOpen(true) }}>
      {children}
      <View pointerEvents="box-none" style={styles.root}>
        {isOpen ? (
          <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
          style={[styles.panelWrap, { bottom: Math.max(insets.bottom, 12) + 72 }]}
          >
            <View style={styles.panel}>
            <View style={styles.header}>
              <View style={styles.avatar}>
                <Ionicons name="sparkles-outline" size={20} color={ORANGE} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{copy.title}</Text>
                <Text style={styles.subtitle}>{configured ? copy.subtitle : copy.unconfigured}</Text>
              </View>
              <TouchableOpacity style={styles.iconButton} onPress={() => setIsOpen(false)}>
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
            </View>
          </KeyboardAvoidingView>
        ) : null}
      </View>
    </AIAssistantContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
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
  panelWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
  },
  panel: {
    height: 480,
    maxHeight: 520,
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

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/context/AuthContext';

const ACCENT = '#FF3B30';
const ORANGE = '#FF6B00';

const LANGUAGES = [
  { code: 'ru', flag: '🇷🇺' },
  { code: 'kz', flag: '🇰🇿' },
  { code: 'en', flag: '🇬🇧' },
] as const;

export default function AdminProfile() {
  const { t, i18n } = useTranslation();
  const { user, logout, updateLanguage } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  const currentLanguageCode = user?.language || i18n.language;
  const currentLanguage =
    LANGUAGES.find((language) => language.code === currentLanguageCode) ?? LANGUAGES[0];

  const handleLogout = () => {
    Alert.alert(t('admin.profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.profile.logout'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  const handleLanguageChange = async (langCode: string) => {
    try {
      await updateLanguage(langCode);
      setIsLanguageModalOpen(false);
    } catch (error) {
      console.error('Language change error:', error);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 48 }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('admin.profile.title')}</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user?.full_name || 'A')}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.full_name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{t('roles.admin')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.profile.settings')}</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingItem} onPress={() => setIsLanguageModalOpen(true)}>
              <View style={[styles.settingIcon, { backgroundColor: '#5856D620' }]}>
                <Ionicons name="language" size={20} color="#5856D6" />
              </View>
              <Text style={styles.settingText}>{t('admin.profile.language')}</Text>
              <View style={styles.languageValue}>
                <Text style={styles.languageFlag}>{currentLanguage.flag}</Text>
                <Text style={styles.settingValue}>{t(`languages.${currentLanguage.code}`)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutCard}
          onPress={handleLogout}
          data-testid="admin-logout-btn"
        >
          <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          <Text style={styles.logoutText}>{t('admin.profile.logout')}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>iKomek 109 v2.0.0 - {t('admin.profile.panel')}</Text>
      </ScrollView>

      <Modal visible={isLanguageModalOpen} transparent animationType="slide">
        <View style={styles.langModalOverlay}>
          <View style={[styles.langModalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.langModalHandle} />
            <Text style={styles.langModalTitle}>{t('admin.profile.language')}</Text>

            {LANGUAGES.map((language) => (
              <TouchableOpacity
                key={language.code}
                style={[
                  styles.langOption,
                  currentLanguageCode === language.code && styles.langOptionActive,
                ]}
                onPress={() => handleLanguageChange(language.code)}
              >
                <Text style={styles.langFlag}>{language.flag}</Text>
                <Text
                  style={[
                    styles.langName,
                    currentLanguageCode === language.code && styles.langNameActive,
                  ]}
                >
                  {t(`languages.${language.code}`)}
                </Text>
                {currentLanguageCode === language.code ? (
                  <Ionicons name="checkmark-circle" size={24} color={ORANGE} />
                ) : null}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.langCloseBtn}
              onPress={() => setIsLanguageModalOpen(false)}
            >
              <Text style={styles.langCloseText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  profileCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
    gap: 4,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  profileEmail: {
    fontSize: 14,
    color: '#8E8E93',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF3B3015',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 2,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: ACCENT,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  settingsCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingItem: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    marginLeft: 12,
  },
  languageValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
  },
  languageFlag: {
    fontSize: 16,
  },
  settingValue: {
    fontSize: 15,
    color: '#8E8E93',
  },
  logoutCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 20,
  },
  langModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  langModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  langModalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  langModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F2F2F7',
  },
  langOptionActive: {
    backgroundColor: `${ORANGE}10`,
    borderWidth: 1,
    borderColor: ORANGE,
  },
  langFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  langName: {
    flex: 1,
    fontSize: 17,
    color: '#1C1C1E',
  },
  langNameActive: {
    fontWeight: '600',
    color: ORANGE,
  },
  langCloseBtn: {
    marginTop: 12,
    padding: 16,
    alignItems: 'center',
  },
  langCloseText: {
    fontSize: 17,
    color: ORANGE,
    fontWeight: '600',
  },
});

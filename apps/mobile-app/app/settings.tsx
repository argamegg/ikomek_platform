import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../src/context/AuthContext';
import { apiService, SavedLocation } from '../src/utils/api';

const ORANGE = '#FF6B00';

const LOCATION_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  home: { icon: 'home', color: '#FF9500' },
  work: { icon: 'briefcase', color: '#007AFF' },
  study: { icon: 'school', color: '#5856D6' },
  other: { icon: 'location', color: '#34C759' },
};

const LANGUAGES = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'kz', name: 'Қазақша', flag: '🇰🇿' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout, updateLanguage } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  useEffect(() => {
    void fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await apiService.getSavedLocations();
      setSavedLocations(response.data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const deleteLocation = async (id: string) => {
    try {
      await apiService.deleteSavedLocation(id);
      setSavedLocations((items) => items.filter((location) => location.id !== id));
    } catch (error) {
      Alert.alert(t('common.error'), t('errors.tryAgain'));
    }
  };

  const handleLanguageChange = async (langCode: string) => {
    await updateLanguage(langCode);
    setIsLanguageModalOpen(false);
  };

  const handleLogout = () => {
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  const currentLanguage = LANGUAGES.find((language) => language.code === (user?.language || i18n.language)) || LANGUAGES[0];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.settings')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('locations.savedLocations')}</Text>
            <Ionicons name="add-circle" size={24} color={ORANGE} />
          </View>
          {savedLocations.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="location-outline" size={32} color="#C7C7CC" />
              <Text style={styles.emptyText}>{t('locations.noLocations')}</Text>
              <Text style={styles.emptySubtext}>{t('locations.saveFrequent')}</Text>
            </View>
          ) : (
            savedLocations.map((location) => {
              const config = LOCATION_ICONS[location.name] || LOCATION_ICONS.other;
              return (
                <View key={location.id} style={styles.locationCard}>
                  <View style={[styles.locationIcon, { backgroundColor: `${config.color}20` }]}>
                    <Ionicons name={config.icon} size={20} color={config.color} />
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationLabel}>{location.label}</Text>
                    <Text style={styles.locationAddress} numberOfLines={1}>{location.address}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(t('common.delete'), `${t('common.delete')} "${location.label}"?`, [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('common.delete'), style: 'destructive', onPress: () => deleteLocation(location.id) },
                      ]);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>
          <TouchableOpacity style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#007AFF20' }]}>
              <Ionicons name="notifications" size={20} color="#007AFF" />
            </View>
            <Text style={styles.settingText}>{t('profile.notifications')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={() => setIsLanguageModalOpen(true)}>
            <View style={[styles.settingIcon, { backgroundColor: '#5856D620' }]}>
              <Ionicons name="language" size={20} color="#5856D6" />
            </View>
            <Text style={styles.settingText}>{t('profile.language')}</Text>
            <View style={styles.languageValue}>
              <Text style={styles.languageFlag}>{currentLanguage.flag}</Text>
              <Text style={styles.settingValue}>{currentLanguage.name}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#34C75920' }]}>
              <Ionicons name="help-circle" size={20} color="#34C759" />
            </View>
            <Text style={styles.settingText}>{t('profile.helpSupport')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#8E8E9320' }]}>
              <Ionicons name="document-text" size={20} color="#8E8E93" />
            </View>
            <Text style={styles.settingText}>{t('profile.termsPrivacy')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={isLanguageModalOpen} transparent animationType="slide">
        <View style={styles.langModalOverlay}>
          <View style={[styles.langModalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.langModalHandle} />
            <Text style={styles.langModalTitle}>{t('profile.language')}</Text>
            {LANGUAGES.map((language) => (
              <TouchableOpacity
                key={language.code}
                style={[
                  styles.langOption,
                  (user?.language || i18n.language) === language.code && styles.langOptionActive,
                ]}
                onPress={() => handleLanguageChange(language.code)}
              >
                <Text style={styles.langFlag}>{language.flag}</Text>
                <Text
                  style={[
                    styles.langName,
                    (user?.language || i18n.language) === language.code && styles.langNameActive,
                  ]}
                >
                  {language.name}
                </Text>
                {(user?.language || i18n.language) === language.code ? (
                  <Ionicons name="checkmark-circle" size={24} color={ORANGE} />
                ) : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.langCloseBtn} onPress={() => setIsLanguageModalOpen(false)}>
              <Text style={styles.langCloseText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  scrollContent: { padding: 16 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  emptyCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#8E8E93', marginTop: 12 },
  emptySubtext: { fontSize: 13, color: '#C7C7CC', marginTop: 4 },
  locationCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  locationIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  locationInfo: { flex: 1, marginLeft: 12 },
  locationLabel: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  locationAddress: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  settingItem: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  settingIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingText: { flex: 1, fontSize: 16, color: '#1C1C1E', marginLeft: 12 },
  settingValue: { fontSize: 15, color: '#8E8E93' },
  languageValue: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 8 },
  languageFlag: { fontSize: 16 },
  logoutButton: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutText: { fontSize: 16, color: '#FF3B30', fontWeight: '700' },
  langModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  langModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  langModalHandle: { width: 36, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  langModalTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 16 },
  langOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 8, backgroundColor: '#F2F2F7' },
  langOptionActive: { backgroundColor: `${ORANGE}10`, borderWidth: 1, borderColor: ORANGE },
  langFlag: { fontSize: 24, marginRight: 12 },
  langName: { flex: 1, fontSize: 17, color: '#1C1C1E' },
  langNameActive: { fontWeight: '700', color: ORANGE },
  langCloseBtn: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  langCloseText: { fontSize: 17, color: '#8E8E93', fontWeight: '700' },
});

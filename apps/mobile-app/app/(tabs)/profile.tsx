import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/context/AuthContext';
import { apiService, SavedLocation } from '../../src/utils/api';

const ORANGE = '#FF6B00';

const LOCATION_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  home: { icon: 'home', color: '#FF9500' },
  work: { icon: 'briefcase', color: '#007AFF' },
  study: { icon: 'school', color: '#5856D6' },
  other: { icon: 'location', color: '#34C759' }
};

const LANGUAGES = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'kz', name: 'Қазақша', flag: '🇰🇿' },
  { code: 'en', name: 'English', flag: '🇬🇧' }
];

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout, updateProfile, updateLanguage, isCitizen, isOperator, isAdmin } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [editName, setEditName] = useState(user?.full_name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await apiService.getSavedLocations();
      setSavedLocations(response.data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('profile.logout'),
      t('profile.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.logout'),
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          }
        }
      ]
    );
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile(editName, editPhone);
      setIsEditingProfile(false);
      Alert.alert(t('common.success'), t('profile.editProfile'));
    } catch (error) {
      Alert.alert(t('common.error'), t('errors.tryAgain'));
    }
  };

  const handleLanguageChange = async (langCode: string) => {
    try {
      await updateLanguage(langCode);
      setIsLanguageModalOpen(false);
    } catch (error) {
      console.error('Language change error:', error);
    }
  };

  const deleteLocation = async (id: string) => {
    try {
      await apiService.deleteSavedLocation(id);
      setSavedLocations(savedLocations.filter(loc => loc.id !== id));
    } catch (error) {
      Alert.alert(t('common.error'), t('errors.tryAgain'));
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = () => {
    if (isAdmin) return { label: t('roles.admin'), color: '#FF3B30' };
    if (isOperator) return { label: t('roles.operator'), color: '#007AFF' };
    return null;
  };

  const roleBadge = getRoleBadge();
  const currentLanguage = LANGUAGES.find(l => l.code === (user?.language || i18n.language)) || LANGUAGES[0];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('profile.title')}</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user?.full_name || 'U')}</Text>
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>{user?.full_name}</Text>
              {roleBadge && (
                <View style={[styles.roleBadge, { backgroundColor: `${roleBadge.color}15` }]}>
                  <Text style={[styles.roleText, { color: roleBadge.color }]}>{roleBadge.label}</Text>
                </View>
              )}
            </View>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            {user?.phone && <Text style={styles.profilePhone}>{user.phone}</Text>}
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              setEditName(user?.full_name || '');
              setEditPhone(user?.phone || '');
              setIsEditingProfile(true);
            }}
          >
            <Ionicons name="pencil" size={18} color={ORANGE} />
          </TouchableOpacity>
        </View>

        {/* Saved Locations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('locations.savedLocations')}</Text>
            <TouchableOpacity>
              <Ionicons name="add-circle" size={24} color={ORANGE} />
            </TouchableOpacity>
          </View>
          
          {savedLocations.length === 0 ? (
            <View style={styles.emptyLocations}>
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
                        { text: t('common.delete'), style: 'destructive', onPress: () => deleteLocation(location.id) }
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

        {/* Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.sectionTitleStandalone]}>{t('profile.settings')}</Text>
          
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

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>iKomek 109 v1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={isEditingProfile} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { paddingTop: insets.top || 16 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsEditingProfile(false)}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('profile.editProfile')}</Text>
            <TouchableOpacity onPress={handleSaveProfile}>
              <Text style={styles.saveText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('auth.fullName')}</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder={t('auth.fullName')}
                placeholderTextColor="#C7C7CC"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('auth.phone')}</Text>
              <TextInput
                style={styles.input}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder={t('auth.phone')}
                placeholderTextColor="#C7C7CC"
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Language Modal */}
      <Modal visible={isLanguageModalOpen} transparent animationType="slide">
        <View style={styles.langModalOverlay}>
          <View style={[styles.langModalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.langModalHandle} />
            <Text style={styles.langModalTitle}>{t('profile.language')}</Text>
            
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langOption,
                  (user?.language || i18n.language) === lang.code && styles.langOptionActive
                ]}
                onPress={() => handleLanguageChange(lang.code)}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={[
                  styles.langName,
                  (user?.language || i18n.language) === lang.code && styles.langNameActive
                ]}>
                  {lang.name}
                </Text>
                {(user?.language || i18n.language) === lang.code && (
                  <Ionicons name="checkmark-circle" size={24} color={ORANGE} />
                )}
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
    backgroundColor: 'transparent'
  },
  scrollContent: {
    padding: 16
  },
  header: {
    paddingVertical: 8,
    marginBottom: 8
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E'
  },
  profileCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold'
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E'
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600'
  },
  profileEmail: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2
  },
  profilePhone: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${ORANGE}15`,
    alignItems: 'center',
    justifyContent: 'center'
  },
  section: {
    marginBottom: 24
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  sectionTitleStandalone: {
    marginBottom: 12
  },
  emptyLocations: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 12
  },
  emptySubtext: {
    fontSize: 13,
    color: '#C7C7CC',
    marginTop: 4
  },
  locationCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  locationInfo: {
    flex: 1,
    marginLeft: 12
  },
  locationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E'
  },
  locationAddress: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2
  },
  settingItem: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    marginLeft: 12
  },
  settingValue: {
    fontSize: 15,
    color: '#8E8E93'
  },
  languageValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8
  },
  languageFlag: {
    fontSize: 16
  },
  logoutButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  logoutText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600'
  },
  version: {
    textAlign: 'center',
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 24
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7'
  },
  cancelText: {
    fontSize: 17,
    color: '#8E8E93'
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E'
  },
  saveText: {
    fontSize: 17,
    color: ORANGE,
    fontWeight: '600'
  },
  modalContent: {
    padding: 20
  },
  inputGroup: {
    marginBottom: 20
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1C1C1E'
  },
  langModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end'
  },
  langModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20
  },
  langModalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20
  },
  langModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F2F2F7'
  },
  langOptionActive: {
    backgroundColor: `${ORANGE}10`,
    borderWidth: 1,
    borderColor: ORANGE
  },
  langFlag: {
    fontSize: 24,
    marginRight: 12
  },
  langName: {
    flex: 1,
    fontSize: 17,
    color: '#1C1C1E'
  },
  langNameActive: {
    fontWeight: '600',
    color: ORANGE
  },
  langCloseBtn: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8
  },
  langCloseText: {
    fontSize: 17,
    color: '#8E8E93',
    fontWeight: '500'
  }
});

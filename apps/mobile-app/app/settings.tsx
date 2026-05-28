import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  LocationPickerMap,
  type LocationPickerCoordinate,
  type LocationPickerMapRef,
} from '../src/components/LocationPickerMap';
import { useAuth } from '../src/context/AuthContext';
import { apiService, SavedLocation } from '../src/utils/api';
import {
  ASTANA_CENTER_LAT,
  ASTANA_CENTER_LNG,
  getDistanceToAstanaKm,
  isWithinAstanaRequestZone,
} from '../src/utils/geoFence';
import {
  hasUsableCoordinate,
  resolveAstanaAddress,
  reverseGeocodeAstanaPoint,
} from '../src/utils/locationGeocoding';

const ORANGE = '#FF6B00';

const LOCATION_TYPES = ['home', 'work', 'study', 'family', 'other'] as const;
type SavedLocationType = (typeof LOCATION_TYPES)[number];

const LOCATION_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  home: { icon: 'home', color: '#FF9500' },
  work: { icon: 'briefcase', color: '#007AFF' },
  study: { icon: 'school', color: '#5856D6' },
  family: { icon: 'people', color: '#AF52DE' },
  other: { icon: 'location', color: '#34C759' },
};

const LANGUAGES = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'kz', name: 'Қазақша', flag: '🇰🇿' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout, updateLanguage, isCitizen } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isFindingAddress, setIsFindingAddress] = useState(false);
  const [isAddressLocating, setIsAddressLocating] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [showAddressMap, setShowAddressMap] = useState(false);
  const [addressMapHint, setAddressMapHint] = useState('');
  const [addressForm, setAddressForm] = useState({
    label: '',
    type: 'home' as SavedLocationType,
    address: '',
    latitude: '',
    longitude: '',
  });
  const addressMapRef = useRef<LocationPickerMapRef>(null);
  const reverseGeocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseGeocodeAbortRef = useRef<AbortController | null>(null);
  const addressMapReadyCoordinateRef = useRef<LocationPickerCoordinate | null>(null);
  const addressModalScrollYRef = useRef(0);
  const addressMapLatitude = Number(addressForm.latitude);
  const addressMapLongitude = Number(addressForm.longitude);
  const addressMapCoordinate = hasUsableCoordinate(addressMapLatitude, addressMapLongitude)
    ? { lat: addressMapLatitude, lng: addressMapLongitude }
    : null;

  const fetchLocations = useCallback(async () => {
    try {
      const response = await apiService.getSavedLocations();
      setSavedLocations(response.data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }, []);

  useEffect(() => {
    if (isCitizen) {
      void fetchLocations();
    }
  }, [fetchLocations, isCitizen]);

  useEffect(() => () => {
    if (reverseGeocodeTimeoutRef.current) {
      clearTimeout(reverseGeocodeTimeoutRef.current);
    }
    reverseGeocodeAbortRef.current?.abort();
  }, []);

  const deleteLocation = async (id: string) => {
    try {
      await apiService.deleteSavedLocation(id);
      setSavedLocations((items) => items.filter((location) => location.id !== id));
    } catch {
      Alert.alert(t('common.error'), t('errors.tryAgain'));
    }
  };

  const resetAddressForm = () => {
    if (reverseGeocodeTimeoutRef.current) {
      clearTimeout(reverseGeocodeTimeoutRef.current);
    }
    reverseGeocodeAbortRef.current?.abort();
    reverseGeocodeAbortRef.current = null;
    setIsResolvingAddress(false);
    addressMapReadyCoordinateRef.current = null;
    setAddressForm({
      label: '',
      type: 'home',
      address: '',
      latitude: '',
      longitude: '',
    });
    setShowAddressMap(false);
    setAddressMapHint('');
  };

  const getAddressZoneHint = useCallback((latitude: number, longitude: number, fallback?: string) => {
    if (isWithinAstanaRequestZone(latitude, longitude)) {
      return fallback ?? t('locations.mapHint');
    }

    return t('locations.outOfZone', {
      distance: Math.round(getDistanceToAstanaKm(latitude, longitude)),
    });
  }, [t]);

  const applyAddressCoordinate = useCallback((latitude: number, longitude: number, hint?: string) => {
    const nextLatitude = Number.isFinite(latitude) ? latitude : ASTANA_CENTER_LAT;
    const nextLongitude = Number.isFinite(longitude) ? longitude : ASTANA_CENTER_LNG;
    addressMapReadyCoordinateRef.current = { lat: nextLatitude, lng: nextLongitude };

    setAddressForm((current) => ({
      ...current,
      latitude: nextLatitude.toFixed(6),
      longitude: nextLongitude.toFixed(6),
    }));
    setShowAddressMap(true);
    setAddressMapHint(getAddressZoneHint(nextLatitude, nextLongitude, hint));
    requestAnimationFrame(() => {
      addressMapRef.current?.centerOnCoordinate(nextLongitude, nextLatitude, 16);
    });
  }, [getAddressZoneHint]);

  const findAddressOnMap = useCallback(async () => {
    const address = addressForm.address.trim();
    Keyboard.dismiss();
    reverseGeocodeAbortRef.current?.abort();
    setIsResolvingAddress(false);

    if (!address) {
      applyAddressCoordinate(ASTANA_CENTER_LAT, ASTANA_CENTER_LNG, t('locations.mapFallback'));
      return;
    }

    setIsFindingAddress(true);
    try {
      const result = await resolveAstanaAddress(address, i18n.language);
      if (!result) {
        applyAddressCoordinate(ASTANA_CENTER_LAT, ASTANA_CENTER_LNG, t('locations.mapFallback'));
        return;
      }

      setAddressForm((current) => ({ ...current, address: result.label || address }));
      applyAddressCoordinate(result.latitude, result.longitude, t('locations.approximateFound'));
    } finally {
      setIsFindingAddress(false);
    }
  }, [addressForm.address, applyAddressCoordinate, i18n.language, t]);

  const locateAddressManually = useCallback(async () => {
    setIsAddressLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      applyAddressCoordinate(location.coords.latitude, location.coords.longitude, t('locations.mapHint'));
    } catch (error) {
      console.error('Location error:', error);
    } finally {
      setIsAddressLocating(false);
    }
  }, [applyAddressCoordinate, t]);

  const handleAddressMapReady = useCallback(() => {
    const coordinate = addressMapReadyCoordinateRef.current;
    addressMapRef.current?.centerOnCoordinate(
      coordinate?.lng ?? ASTANA_CENTER_LNG,
      coordinate?.lat ?? ASTANA_CENTER_LAT,
      coordinate ? 16 : 12,
    );
  }, []);

  const handleAddressMapChange = useCallback(({ lat, lng }: LocationPickerCoordinate) => {
    const nextLatitude = lat.toFixed(6);
    const nextLongitude = lng.toFixed(6);
    addressMapReadyCoordinateRef.current = { lat, lng };
    setAddressForm((current) => ({
      ...current,
      latitude: nextLatitude,
      longitude: nextLongitude,
    }));
    setAddressMapHint(getAddressZoneHint(lat, lng));
    if (reverseGeocodeTimeoutRef.current) {
      clearTimeout(reverseGeocodeTimeoutRef.current);
    }
    reverseGeocodeAbortRef.current?.abort();
    setIsResolvingAddress(true);
    reverseGeocodeTimeoutRef.current = setTimeout(() => {
      const controller = new AbortController();
      reverseGeocodeAbortRef.current = controller;

      void reverseGeocodeAstanaPoint(lat, lng, i18n.language, controller.signal)
        .then((nextAddress) => {
          if (!nextAddress.trim()) return;
          setAddressForm((current) => ({
            ...current,
            address: current.latitude === nextLatitude && current.longitude === nextLongitude
              ? nextAddress
              : current.address,
          }));
        })
        .catch((error: unknown) => {
          if (
            error &&
            typeof error === 'object' &&
            'name' in error &&
            (error as { name?: string }).name === 'AbortError'
          ) {
            return;
          }
        })
        .finally(() => {
          if (reverseGeocodeAbortRef.current === controller) {
            reverseGeocodeAbortRef.current = null;
            setIsResolvingAddress(false);
          }
        });
    }, 300);
  }, [getAddressZoneHint, i18n.language]);

  const saveLocation = async () => {
    const label = addressForm.label.trim();
    let address = addressForm.address.trim();
    if (!label || !address) {
      Alert.alert(t('common.error'), t('locations.fillRequired'));
      return;
    }

    setIsSavingAddress(true);
    try {
      let latitude = Number(addressForm.latitude);
      let longitude = Number(addressForm.longitude);

      if (!hasUsableCoordinate(latitude, longitude)) {
        const result = await resolveAstanaAddress(address, i18n.language);
        if (!result) {
          applyAddressCoordinate(ASTANA_CENTER_LAT, ASTANA_CENTER_LNG, t('locations.mapFallback'));
          Alert.alert(t('common.error'), t('locations.addressNotFound'));
          return;
        }
        latitude = result.latitude;
        longitude = result.longitude;
        address = result.label || address;
        setAddressForm((current) => ({ ...current, address }));
      }
      if (!isWithinAstanaRequestZone(latitude, longitude)) {
        applyAddressCoordinate(latitude, longitude);
        Alert.alert(t('common.error'), t('locations.outOfZone', {
          distance: Math.round(getDistanceToAstanaKm(latitude, longitude)),
        }));
        return;
      }

      const response = await apiService.createSavedLocation({
        name: addressForm.type,
        label,
        address,
        latitude,
        longitude,
      });
      setSavedLocations((items) => [response.data, ...items]);
      resetAddressForm();
      setIsAddressModalOpen(false);
    } catch {
      Alert.alert(t('common.error'), t('errors.tryAgain'));
    } finally {
      setIsSavingAddress(false);
    }
  };

  const closeAddressModal = () => {
    Keyboard.dismiss();
    setIsAddressModalOpen(false);
    resetAddressForm();
  };

  const requestAddressModalClose = () => {
    if (isSavingAddress) return;

    Keyboard.dismiss();
    Alert.alert(
      t('locations.cancelAddressTitle'),
      t('locations.cancelAddressMessage'),
      [
        {
          text: t('locations.keepEditing'),
          style: 'cancel',
        },
        {
          text: t('locations.discardAddress'),
          style: 'destructive',
          onPress: closeAddressModal,
        },
      ],
    );
  };

  const addressModalPanResponder = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => (
      addressModalScrollYRef.current <= 0 &&
      gesture.dy > 16 &&
      Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2
    ),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 70 || gesture.vy > 0.75) {
        requestAddressModalClose();
      }
    },
  });

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
        {isCitizen ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('locations.savedLocations')}</Text>
            <TouchableOpacity onPress={() => setIsAddressModalOpen(true)} style={styles.addAddressButton}>
              <Ionicons name="add" size={20} color="#FFF" />
            </TouchableOpacity>
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
        ) : null}

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

      <Modal visible={isAddressModalOpen} transparent animationType="slide" onRequestClose={requestAddressModalClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingOverlay}
        >
          <View style={styles.langModalOverlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={requestAddressModalClose}
                accessibilityRole="button"
                accessibilityLabel={t('locations.cancelAddressTitle')}
              />
              <View
                style={[styles.langModalContent, styles.addressModalContent, { paddingBottom: insets.bottom + 16 }]}
                {...addressModalPanResponder.panHandlers}
              >
                <View style={styles.modalSwipeHandleArea} {...addressModalPanResponder.panHandlers}>
                  <View style={[styles.langModalHandle, styles.addressModalHandle]} />
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  scrollEventThrottle={16}
                  onScroll={(event) => {
                    addressModalScrollYRef.current = event.nativeEvent.contentOffset.y;
                  }}
                  contentContainerStyle={styles.addressModalScrollContent}
                >
                  <Text style={styles.langModalTitle}>{t('locations.addLocation')}</Text>

                  <Text style={styles.modalLabel}>{t('locations.locationType')}</Text>
                  <View style={styles.typeGrid}>
                    {LOCATION_TYPES.map((type) => {
                      const active = addressForm.type === type;
                      const config = LOCATION_ICONS[type];
                      return (
                        <TouchableOpacity
                          key={type}
                          style={[styles.typeChip, active && styles.typeChipActive]}
                          onPress={() => setAddressForm((current) => ({ ...current, type }))}
                        >
                          <Ionicons name={config.icon} size={16} color={active ? ORANGE : '#64748B'} />
                          <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{t(`locations.${type}`)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TextInput
                    style={styles.addressModalInput}
                    value={addressForm.label}
                    onChangeText={(label) => setAddressForm((current) => ({ ...current, label }))}
                    placeholder={t('locations.labelPlaceholder')}
                    placeholderTextColor="#C7C7CC"
                    returnKeyType="next"
                  />
                  <TextInput
                    style={[styles.addressModalInput, styles.addressModalTextArea]}
                    value={addressForm.address}
                    onChangeText={(address) => {
                      if (reverseGeocodeTimeoutRef.current) {
                        clearTimeout(reverseGeocodeTimeoutRef.current);
                      }
                      reverseGeocodeAbortRef.current?.abort();
                      reverseGeocodeAbortRef.current = null;
                      setIsResolvingAddress(false);
                      setAddressForm((current) => ({
                        ...current,
                        address,
                        latitude: '',
                        longitude: '',
                      }));
                      setShowAddressMap(false);
                      setAddressMapHint('');
                    }}
                    placeholder={t('locations.addressPlaceholder')}
                    placeholderTextColor="#C7C7CC"
                    multiline
                    scrollEnabled
                    textAlignVertical="top"
                    returnKeyType="done"
                    blurOnSubmit
                  />
                  <TouchableOpacity
                    style={[styles.findAddressButton, isFindingAddress && styles.disabledButton]}
                    onPress={findAddressOnMap}
                    disabled={isFindingAddress}
                    activeOpacity={0.85}
                  >
                    {isFindingAddress ? (
                      <ActivityIndicator color={ORANGE} />
                    ) : (
                      <Ionicons name="map-outline" size={18} color={ORANGE} />
                    )}
                    <Text style={styles.findAddressText}>
                      {isFindingAddress ? t('locations.findingAddress') : t('locations.findOnMap')}
                    </Text>
                  </TouchableOpacity>
                  {showAddressMap ? (
                    <View style={styles.addressPickerCard}>
                      <View style={styles.addressPickerHeader}>
                        <View style={styles.addressPickerTitleRow}>
                          {isResolvingAddress ? <ActivityIndicator size="small" color={ORANGE} /> : null}
                          <Text style={styles.addressPickerTitle}>
                            {isResolvingAddress ? t('locations.resolvingAddress') : t('locations.mapTitle')}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            if (reverseGeocodeTimeoutRef.current) {
                              clearTimeout(reverseGeocodeTimeoutRef.current);
                            }
                            reverseGeocodeAbortRef.current?.abort();
                            reverseGeocodeAbortRef.current = null;
                            setIsResolvingAddress(false);
                            setShowAddressMap(false);
                          }}
                          style={styles.addressPickerClose}
                        >
                          <Ionicons name="chevron-up" size={18} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.addressPickerMap}>
                        <LocationPickerMap
                          ref={addressMapRef}
                          coordinate={addressMapCoordinate}
                          onCoordinateChange={handleAddressMapChange}
                          onMapReady={handleAddressMapReady}
                          onLocateMePress={locateAddressManually}
                          isLocating={isAddressLocating}
                        />
                      </View>
                      <Text style={styles.modalHint}>{addressMapHint || t('locations.mapHint')}</Text>
                    </View>
                  ) : null}
                  <View style={styles.coordinateRow}>
                    <TextInput
                      style={[styles.addressModalInput, styles.coordinateInput]}
                      value={addressForm.latitude}
                      onChangeText={(latitude) => setAddressForm((current) => ({ ...current, latitude }))}
                      placeholder={t('locations.latitude')}
                      placeholderTextColor="#C7C7CC"
                      keyboardType="decimal-pad"
                    />
                    <TextInput
                      style={[styles.addressModalInput, styles.coordinateInput]}
                      value={addressForm.longitude}
                      onChangeText={(longitude) => setAddressForm((current) => ({ ...current, longitude }))}
                      placeholder={t('locations.longitude')}
                      placeholderTextColor="#C7C7CC"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <Text style={styles.modalHint}>{t('locations.coordinatesHint')}</Text>

                  <TouchableOpacity style={[styles.saveAddressButton, isSavingAddress && styles.disabledButton]} onPress={saveLocation} disabled={isSavingAddress}>
                    {isSavingAddress ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveAddressText}>{t('locations.saveAddress')}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.langCloseBtn}
                    onPress={requestAddressModalClose}
                  >
                    <Text style={styles.langCloseText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
        </KeyboardAvoidingView>
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
  addAddressButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
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
  keyboardAvoidingOverlay: { flex: 1 },
  langModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  langModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  addressModalContent: { maxHeight: '88%' },
  addressModalScrollContent: { paddingBottom: 12 },
  modalSwipeHandleArea: { alignItems: 'center', paddingTop: 4, paddingBottom: 20 },
  langModalHandle: { width: 36, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  addressModalHandle: { marginBottom: 0 },
  langModalTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 16 },
  langOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 8, backgroundColor: '#F2F2F7' },
  langOptionActive: { backgroundColor: `${ORANGE}10`, borderWidth: 1, borderColor: ORANGE },
  langFlag: { fontSize: 24, marginRight: 12 },
  langName: { flex: 1, fontSize: 17, color: '#1C1C1E' },
  langNameActive: { fontWeight: '700', color: ORANGE },
  langCloseBtn: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  langCloseText: { fontSize: 17, color: '#8E8E93', fontWeight: '700' },
  modalLabel: { fontSize: 13, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 10 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#FFF' },
  typeChipActive: { borderColor: ORANGE, backgroundColor: `${ORANGE}10` },
  typeChipText: { color: '#64748B', fontSize: 13, fontWeight: '800' },
  typeChipTextActive: { color: ORANGE },
  addressModalInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1C1C1E', fontWeight: '600', marginBottom: 10 },
  addressModalTextArea: { minHeight: 74, textAlignVertical: 'top' },
  findAddressButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: `${ORANGE}55`, backgroundColor: `${ORANGE}10`, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  findAddressText: { color: ORANGE, fontSize: 15, fontWeight: '800' },
  addressPickerCard: { borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F8FAFC', borderRadius: 18, padding: 10, marginBottom: 12 },
  addressPickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  addressPickerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 },
  addressPickerTitle: { color: '#1C1C1E', fontSize: 14, fontWeight: '800' },
  addressPickerClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  addressPickerMap: { height: 230, overflow: 'hidden', borderRadius: 14, backgroundColor: '#E2E8F0', marginBottom: 10 },
  coordinateRow: { flexDirection: 'row', gap: 10 },
  coordinateInput: { flex: 1 },
  modalHint: { color: '#94A3B8', fontSize: 12, lineHeight: 17, marginBottom: 12 },
  saveAddressButton: { minHeight: 52, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  disabledButton: { opacity: 0.6 },
  saveAddressText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});

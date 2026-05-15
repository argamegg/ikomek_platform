import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import {
  LocationPickerMap,
  type LocationPickerCoordinate,
  type LocationPickerMapRef,
} from '../../src/components/LocationPickerMap';
import {
  ASTANA_CENTER_LAT,
  ASTANA_CENTER_LNG,
  getDistanceToAstanaKm,
  isWithinAstanaRequestZone,
} from '../../src/utils/geoFence';
import { apiService, type SavedLocation } from '../../src/utils/api';

const ORANGE = '#FF6B00';
const LOCATION_TYPES = ['home', 'work', 'study', 'family', 'other'] as const;
type SavedLocationType = (typeof LOCATION_TYPES)[number];

const LOCATION_ICONS: Record<SavedLocationType, keyof typeof Ionicons.glyphMap> = {
  home: 'home',
  work: 'briefcase',
  study: 'school',
  family: 'people',
  other: 'location',
};

export default function LocationScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const categoryId = params.categoryId as string;
  
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState({ lat: ASTANA_CENTER_LAT, lng: ASTANA_CENTER_LNG });
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [selectedSavedLocationId, setSelectedSavedLocationId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [saveForm, setSaveForm] = useState({ label: '', type: 'home' as SavedLocationType });
  
  const mapRef = useRef<LocationPickerMapRef>(null);
  const reverseGeocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWithinAllowedZone = useMemo(
    () => isWithinAstanaRequestZone(coordinates.lat, coordinates.lng),
    [coordinates.lat, coordinates.lng],
  );
  const distanceToAstanaKm = useMemo(
    () => getDistanceToAstanaKm(coordinates.lat, coordinates.lng),
    [coordinates.lat, coordinates.lng],
  );

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const loc = results[0];
        const parts = [
          loc.street,
          loc.streetNumber,
          loc.district,
          loc.city
        ].filter(Boolean);
        setAddress(parts.join(', ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  }, []);

  const getCurrentLocation = useCallback(async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;

        setSelectedSavedLocationId('');
        setCoordinates({ lat: latitude, lng: longitude });
        mapRef.current?.centerOnCoordinate(longitude, latitude, 16);
        await reverseGeocode(latitude, longitude);
      }
    } catch (error) {
      console.error('Location error:', error);
    } finally {
      setIsLocating(false);
    }
  }, [reverseGeocode]);

  const fetchSavedLocations = useCallback(async () => {
    try {
      const response = await apiService.getSavedLocations();
      setSavedLocations(response.data);
    } catch (error) {
      console.error('Saved locations error:', error);
    }
  }, []);

  useEffect(() => {
    void fetchSavedLocations();
    return () => {
      if (reverseGeocodeTimeoutRef.current) {
        clearTimeout(reverseGeocodeTimeoutRef.current);
      }
    };
  }, [fetchSavedLocations]);

  const handleMapReady = useCallback(() => {
    setIsLoading(false);
    mapRef.current?.centerOnCoordinate(coordinates.lng, coordinates.lat, 16);
    void reverseGeocode(coordinates.lat, coordinates.lng);
  }, [coordinates.lat, coordinates.lng, reverseGeocode]);

  const handleCoordinateChange = useCallback(
    ({ lat, lng }: LocationPickerCoordinate) => {
      setCoordinates({ lat, lng });
      setSelectedSavedLocationId('');
      if (reverseGeocodeTimeoutRef.current) {
        clearTimeout(reverseGeocodeTimeoutRef.current);
      }

      reverseGeocodeTimeoutRef.current = setTimeout(() => {
        void reverseGeocode(lat, lng);
      }, 250);
    },
    [reverseGeocode],
  );

  const applySavedLocation = (location: SavedLocation) => {
    setSelectedSavedLocationId(location.id);
    setAddress(location.address);
    setCoordinates({ lat: location.latitude, lng: location.longitude });
    mapRef.current?.centerOnCoordinate(location.longitude, location.latitude, 16);
  };

  const saveCurrentLocation = async () => {
    const label = saveForm.label.trim();
    if (!label || !address.trim()) {
      Alert.alert(t('common.error'), t('locations.fillRequired'));
      return;
    }

    setIsSavingLocation(true);
    try {
      const response = await apiService.createSavedLocation({
        name: saveForm.type,
        label,
        address: address.trim(),
        latitude: coordinates.lat,
        longitude: coordinates.lng,
      });
      setSavedLocations((items) => [response.data, ...items]);
      setSelectedSavedLocationId(response.data.id);
      setSaveForm({ label: '', type: 'home' });
      setIsSaveModalOpen(false);
      Alert.alert(t('common.success'), t('locations.savedSuccess'));
    } catch {
      Alert.alert(t('common.error'), t('errors.tryAgain'));
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleContinue = () => {
    if (!address) {
      Alert.alert(t('common.error'), t('request.locationRequired'));
      return;
    }

    if (!isWithinAllowedZone) {
      Alert.alert(t('common.error'), t('request.outOfZone'));
      return;
    }
    
    router.push({
      pathname: '/request/details',
      params: {
        categoryId,
        address,
        latitude: coordinates.lat.toString(),
        longitude: coordinates.lng.toString()
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t('request.selectLocationTitle')}</Text>
          <Text style={styles.headerSubtitle}>{t('request.dragMap')}</Text>
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <LocationPickerMap
          ref={mapRef}
          onMapReady={handleMapReady}
          onCoordinateChange={handleCoordinateChange}
          onLocateMePress={() => void getCurrentLocation()}
          isLocating={isLocating}
        />
        
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={ORANGE} />
          </View>
        )}
      </View>

      {/* Bottom Panel */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]}>
        {savedLocations.length > 0 ? (
          <View style={styles.savedBlock}>
            <Text style={styles.savedTitle}>{t('locations.savedLocations')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedList}>
              {savedLocations.map((location) => {
                const active = selectedSavedLocationId === location.id;
                const icon = LOCATION_ICONS[(location.name as SavedLocationType) || 'other'] || LOCATION_ICONS.other;
                return (
                  <TouchableOpacity
                    key={location.id}
                    style={[styles.savedChip, active && styles.savedChipActive]}
                    onPress={() => applySavedLocation(location)}
                  >
                    <Ionicons name={icon} size={16} color={active ? ORANGE : '#64748B'} />
                    <View style={styles.savedChipTextWrap}>
                      <Text style={[styles.savedChipLabel, active && styles.savedChipLabelActive]} numberOfLines={1}>{location.label}</Text>
                      <Text style={styles.savedChipAddress} numberOfLines={1}>{location.address}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.addressContainer}>
          <Ionicons name="location" size={24} color={ORANGE} />
          <View style={styles.addressContent}>
            <Text style={styles.addressLabel}>{t('request.selectedAddress')}</Text>
            <TextInput
              style={styles.addressInput}
              value={address}
              onChangeText={(value) => {
                setSelectedSavedLocationId('');
                setAddress(value);
              }}
              placeholder={t('request.addressPlaceholder')}
              placeholderTextColor="#C7C7CC"
              multiline
            />
          </View>
        </View>
        {!isWithinAllowedZone ? (
          <Text style={styles.zoneWarning}>{t('request.outOfZone')}</Text>
        ) : (
          <Text style={styles.zoneHint}>
            {t('request.zoneHint', { distance: Math.round(distanceToAstanaKm) })}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.saveCurrentButton, (!address || !isWithinAllowedZone) && styles.buttonDisabled]}
          onPress={() => {
            setSaveForm((current) => ({
              ...current,
              label: current.label || address.split(',')[0]?.trim() || t('locations.labelPlaceholder'),
            }));
            setIsSaveModalOpen(true);
          }}
          disabled={!address || !isWithinAllowedZone}
        >
          <Ionicons name="bookmark-outline" size={18} color={ORANGE} />
          <View style={styles.saveCurrentCopy}>
            <Text style={styles.saveCurrentTitle}>{t('locations.saveCurrent')}</Text>
            <Text style={styles.saveCurrentHint}>{t('locations.saveCurrentHint')}</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.continueButton, (!address || !isWithinAllowedZone) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!address || !isWithinAllowedZone}
        >
          <Text style={styles.continueText}>{t('common.continue')}</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <Modal visible={isSaveModalOpen} transparent animationType="slide" onRequestClose={() => setIsSaveModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('locations.addLocation')}</Text>
            <Text style={styles.modalLabel}>{t('locations.locationType')}</Text>
            <View style={styles.typeGrid}>
              {LOCATION_TYPES.map((type) => {
                const active = saveForm.type === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, active && styles.typeChipActive]}
                    onPress={() => setSaveForm((current) => ({ ...current, type }))}
                  >
                    <Ionicons name={LOCATION_ICONS[type]} size={16} color={active ? ORANGE : '#64748B'} />
                    <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{t(`locations.${type}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={styles.modalInput}
              value={saveForm.label}
              onChangeText={(label) => setSaveForm((current) => ({ ...current, label }))}
              placeholder={t('locations.labelPlaceholder')}
              placeholderTextColor="#C7C7CC"
            />
            <View style={styles.modalAddressPreview}>
              <Ionicons name="location" size={18} color={ORANGE} />
              <Text style={styles.modalAddressText}>{address}</Text>
            </View>
            <TouchableOpacity style={[styles.modalSaveButton, isSavingLocation && styles.buttonDisabled]} onPress={saveCurrentLocation} disabled={isSavingLocation}>
              {isSavingLocation ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSaveText}>{t('locations.saveAddress')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setIsSaveModalOpen(false)}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
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
  header: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    zIndex: 100
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerContent: {
    flex: 1,
    marginLeft: 8
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E'
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
    marginTop: 2
  },
  mapContainer: {
    flex: 1
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  bottomPanel: {
    backgroundColor: '#FFF',
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10
  },
  savedBlock: {
    marginBottom: 14
  },
  savedTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 8
  },
  savedList: {
    gap: 8,
    paddingRight: 12
  },
  savedChip: {
    width: 190,
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  savedChipActive: {
    borderColor: ORANGE,
    backgroundColor: `${ORANGE}10`
  },
  savedChipTextWrap: { flex: 1 },
  savedChipLabel: { color: '#1C1C1E', fontSize: 14, fontWeight: '800' },
  savedChipLabelActive: { color: ORANGE },
  savedChipAddress: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  addressContent: {
    flex: 1,
    marginLeft: 12
  },
  addressLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 4
  },
  addressInput: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22
  },
  zoneHint: {
    fontSize: 12,
    lineHeight: 18,
    color: '#8E8E93',
    marginBottom: 14
  },
  zoneWarning: {
    fontSize: 12,
    lineHeight: 18,
    color: '#FF3B30',
    fontWeight: '600',
    marginBottom: 14
  },
  saveCurrentButton: {
    borderWidth: 1,
    borderColor: `${ORANGE}33`,
    backgroundColor: `${ORANGE}0D`,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14
  },
  saveCurrentCopy: { flex: 1 },
  saveCurrentTitle: { color: '#1C1C1E', fontSize: 14, fontWeight: '800' },
  saveCurrentHint: { color: '#64748B', fontSize: 12, lineHeight: 16, marginTop: 2 },
  continueButton: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  buttonDisabled: {
    opacity: 0.5
  },
  continueText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600'
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 18 },
  modalTitle: { color: '#1C1C1E', fontSize: 22, fontWeight: '900', marginBottom: 16 },
  modalLabel: { fontSize: 12, fontWeight: '900', color: '#64748B', textTransform: 'uppercase', marginBottom: 10 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#FFF' },
  typeChipActive: { borderColor: ORANGE, backgroundColor: `${ORANGE}10` },
  typeChipText: { color: '#64748B', fontSize: 13, fontWeight: '800' },
  typeChipTextActive: { color: ORANGE },
  modalInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1C1C1E', fontWeight: '700', marginBottom: 12 },
  modalAddressPreview: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, backgroundColor: '#F8FAFC', padding: 12, marginBottom: 14 },
  modalAddressText: { flex: 1, color: '#475569', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  modalSaveButton: { minHeight: 52, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  modalSaveText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  modalCancelButton: { minHeight: 50, borderRadius: 16, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  modalCancelText: { color: '#64748B', fontSize: 16, fontWeight: '800' }
});

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  LocationPickerMap,
  type LocationPickerCoordinate,
  type LocationPickerMapRef,
} from '../../src/components/LocationPickerMap';

const ORANGE = '#FF6B00';

export default function LocationScreen() {
  const params = useLocalSearchParams();
  const categoryId = params.categoryId as string;
  
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState({ lat: 51.1282, lng: 71.4306 });
  const [isLoading, setIsLoading] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  
  const mapRef = useRef<LocationPickerMapRef>(null);
  const reverseGeocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  useEffect(() => {
    // Try to get user's current location on mount
    void getCurrentLocation();
  }, [getCurrentLocation]);

  useEffect(() => {
    return () => {
      if (reverseGeocodeTimeoutRef.current) {
        clearTimeout(reverseGeocodeTimeoutRef.current);
      }
    };
  }, []);

  const handleMapReady = useCallback(() => {
    setIsLoading(false);
    mapRef.current?.centerOnCoordinate(coordinates.lng, coordinates.lat, 16);
  }, [coordinates.lat, coordinates.lng]);

  const handleCoordinateChange = useCallback(
    ({ lat, lng }: LocationPickerCoordinate) => {
      setCoordinates({ lat, lng });
      if (reverseGeocodeTimeoutRef.current) {
        clearTimeout(reverseGeocodeTimeoutRef.current);
      }

      reverseGeocodeTimeoutRef.current = setTimeout(() => {
        void reverseGeocode(lat, lng);
      }, 250);
    },
    [reverseGeocode],
  );

  const handleContinue = () => {
    if (!address) {
      Alert.alert('Error', 'Please select a location on the map');
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
          <Text style={styles.headerTitle}>Select Location</Text>
          <Text style={styles.headerSubtitle}>Drag the map to set the location</Text>
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
        <View style={styles.addressContainer}>
          <Ionicons name="location" size={24} color={ORANGE} />
          <View style={styles.addressContent}>
            <Text style={styles.addressLabel}>Selected Address</Text>
            <TextInput
              style={styles.addressInput}
              value={address}
              onChangeText={setAddress}
              placeholder="Address will appear here..."
              placeholderTextColor="#C7C7CC"
              multiline
            />
          </View>
        </View>
        
        <TouchableOpacity
          style={[styles.continueButton, !address && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!address}
        >
          <Text style={styles.continueText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
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
    color: '#8E8E93',
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
  }
});

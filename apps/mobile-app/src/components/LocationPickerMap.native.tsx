import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

let MapLibre: typeof import('@maplibre/maplibre-react-native') | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MapLibre = require('@maplibre/maplibre-react-native');
  MapLibre?.Logger.setLogCallback((log) => (
    log.tag === 'Mbgl-HttpRequest' &&
    log.message.startsWith('Request failed due to a permanent error: Canceled')
  ));
} catch (error) {
  console.warn('MapLibre native module is unavailable. Open the app in a development build.', error);
}

const ORANGE = '#FF6B00';
const ASTANA_CENTER: [number, number] = [71.4306, 51.1282];
const MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '\u00A9 OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
} as const;

export type LocationPickerCoordinate = {
  lat: number;
  lng: number;
};

export type LocationPickerMapRef = {
  centerOnCoordinate: (lng: number, lat: number, zoom?: number) => void;
};

type LocationPickerMapProps = {
  onCoordinateChange: (coordinate: LocationPickerCoordinate) => void;
  onMapReady: () => void;
  onLocateMePress: () => void;
  isLocating: boolean;
  coordinate?: LocationPickerCoordinate | null;
  showUserLocation?: boolean;
};

export const LocationPickerMap = forwardRef<LocationPickerMapRef, LocationPickerMapProps>(
  ({ onCoordinateChange, onMapReady, onLocateMePress, isLocating, coordinate = null, showUserLocation = false }, ref) => {
    const { t } = useTranslation();
    const cameraRef = useRef<any>(null);
    const mapRef = useRef<any>(null);

    const defaultCamera = useMemo(
      () => ({
        centerCoordinate: coordinate ? [coordinate.lng, coordinate.lat] : ASTANA_CENTER,
        zoomLevel: coordinate ? 16 : 14,
      }),
      [coordinate?.lat, coordinate?.lng],
    );

    const centerOnCoordinate = useCallback((lng: number, lat: number, zoom = 16) => {
      cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel: zoom,
        animationDuration: 500,
      });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        centerOnCoordinate,
      }),
      [centerOnCoordinate],
    );

    const handleRegionDidChange = useCallback(
      (event: any) => {
        const coords = event?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return;

        onCoordinateChange({
          lng: coords[0],
          lat: coords[1],
        });
      },
      [onCoordinateChange],
    );

    const handleZoom = useCallback(
      async (delta: number) => {
        if (!MapLibre) return;
        const currentZoom = await mapRef.current?.getZoom?.();
        if (typeof currentZoom !== 'number') return;

        cameraRef.current?.zoomTo(
          Math.max(10, Math.min(19, currentZoom + delta)),
          250,
        );
      },
      [],
    );

    if (!MapLibre) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>{t('map.devBuildRequiredTitle')}</Text>
          <Text style={styles.fallbackText}>{t('map.devBuildRequiredLocation')}</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <MapLibre.MapView
          ref={mapRef}
          style={styles.map}
          mapStyle={MAP_STYLE}
          logoEnabled={false}
          attributionEnabled={false}
          compassEnabled
          rotateEnabled={false}
          regionDidChangeDebounceTime={150}
          onDidFinishLoadingMap={onMapReady}
          onRegionDidChange={handleRegionDidChange}
        >
          <MapLibre.Camera ref={cameraRef} defaultSettings={defaultCamera} />
          {showUserLocation ? (
            <MapLibre.UserLocation visible renderMode="normal" />
          ) : null}
        </MapLibre.MapView>

        <View pointerEvents="none" style={styles.centerMarker}>
          <Ionicons name="location" size={44} color={ORANGE} />
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => void handleZoom(1)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#1C1C1E" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => void handleZoom(-1)}
            activeOpacity={0.8}
          >
            <Ionicons name="remove" size={22} color="#1C1C1E" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={onLocateMePress}
            activeOpacity={0.8}
            disabled={isLocating}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={ORANGE} />
            ) : (
              <Ionicons name="locate" size={20} color={ORANGE} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  },
);

LocationPickerMap.displayName = 'LocationPickerMap';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F2F2F7',
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 8,
  },
  fallbackText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  centerMarker: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -22,
    marginTop: -44,
  },
  controls: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    gap: 8,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
});

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MapPoint } from '../utils/api';

let MapLibre: typeof import('@maplibre/maplibre-react-native') | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MapLibre = require('@maplibre/maplibre-react-native');
} catch (error) {
  console.warn('MapLibre native module is unavailable. Open the app in a development build.', error);
}

const ASTANA_CENTER: [number, number] = [71.4306, 51.1282];
const CLUSTER_COLOR = 'rgba(255, 107, 0, 0.88)';
const MARKER_COLOR = 'rgba(15, 23, 42, 0.75)';
const MY_MARKER_COLOR = 'rgba(255, 107, 0, 0.92)';
const MARKER_STROKE = 'rgba(255,255,255,0.92)';
const NATIVE_MAP_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
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

type RequestsMapProps = {
  points: MapPoint[];
  categoryColors: Record<string, string>;
  statusColors: Record<string, string>;
  onPointPress: (point: MapPoint) => void;
};

export function RequestsMap({
  points,
  categoryColors: _categoryColors,
  statusColors: _statusColors,
  onPointPress,
}: RequestsMapProps) {
  const cameraRef = useRef<any>(null);
  const shapeSourceRef = useRef<any>(null);

  const pointFeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: points.map((point) => ({
        type: 'Feature',
        id: point.id,
        properties: {
          pointId: point.id,
          is_mine: point.is_mine ? 1 : 0,
          color: point.is_mine ? MY_MARKER_COLOR : MARKER_COLOR,
          radius: 10,
        },
        geometry: {
          type: 'Point',
          coordinates: [point.lng, point.lat],
        },
      })),
    }),
    [points],
  );

  const clusterCircleStyle = useMemo(
    () =>
      ({
        circleColor: CLUSTER_COLOR,
        circleRadius: [
          'interpolate',
          ['linear'],
          ['get', 'point_count'],
          1,
          16,
          10,
          20,
          25,
          24,
        ],
        circleStrokeColor: MARKER_STROKE,
        circleStrokeWidth: 3,
        circleOpacity: 1,
      }) as any,
    [],
  );

  const clusterCountStyle = useMemo(
    () =>
      ({
        textField: ['get', 'point_count_abbreviated'],
        textSize: 12,
        textFont: ['Noto Sans Regular'],
        textColor: '#FFFFFF',
        textAllowOverlap: true,
        textIgnorePlacement: true,
      }) as any,
    [],
  );

  const unclusteredPointStyle = useMemo(
    () =>
      ({
        circleColor: ['coalesce', ['get', 'color'], MARKER_COLOR],
        circleRadius: ['coalesce', ['get', 'radius'], 10],
        circleStrokeColor: MARKER_STROKE,
        circleStrokeWidth: 3,
        circleOpacity: 1,
      }) as any,
    [],
  );

  const handleNativePointPress = useCallback(
    async (event: any) => {
      const feature = event?.features?.[0];
      if (!feature) return;

      if (feature.properties?.cluster) {
        const zoomLevel = await shapeSourceRef.current?.getClusterExpansionZoom(feature);
        const coordinates = feature.geometry?.coordinates;

        if (Array.isArray(coordinates) && coordinates.length >= 2) {
          cameraRef.current?.setCamera({
            centerCoordinate: [coordinates[0], coordinates[1]],
            zoomLevel: typeof zoomLevel === 'number' ? zoomLevel : 14,
            animationDuration: 350,
          });
        }
        return;
      }

      const pointId = feature.properties?.pointId;
      if (!pointId) return;

      const point = points.find((item) => item.id === pointId);
      if (point) onPointPress(point);
    },
    [onPointPress, points],
  );

  useEffect(() => {
    if (!MapLibre) return;
    if (!cameraRef.current) return;

    if (points.length === 0) {
      cameraRef.current.setCamera({
        centerCoordinate: ASTANA_CENTER,
        zoomLevel: 11.5,
        animationDuration: 600,
      });
      return;
    }

    if (points.length === 1) {
      const point = points[0];
      cameraRef.current.setCamera({
        centerCoordinate: [point.lng, point.lat],
        zoomLevel: 14,
        animationDuration: 600,
      });
      return;
    }

    const lngs = points.map((point) => point.lng);
    const lats = points.map((point) => point.lat);

    cameraRef.current.fitBounds(
      [Math.max(...lngs), Math.max(...lats)],
      [Math.min(...lngs), Math.min(...lats)],
      56,
      700,
    );
  }, [points]);

  if (!MapLibre) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Map requires the development build</Text>
        <Text style={styles.fallbackText}>Open iKOMEKMobileApp instead of Expo Go to use the live map.</Text>
      </View>
    );
  }

  return (
    <MapLibre.MapView
      style={styles.map}
      mapStyle={NATIVE_MAP_STYLE}
      logoEnabled={false}
      attributionEnabled={false}
      compassEnabled
      rotateEnabled={false}
    >
      <MapLibre.Camera
        ref={cameraRef}
        defaultSettings={{
          centerCoordinate: ASTANA_CENTER,
          zoomLevel: 11.5,
        }}
      />

      <MapLibre.UserLocation visible renderMode="normal" />

      <MapLibre.ShapeSource
        ref={shapeSourceRef}
        id="requests"
        shape={pointFeatureCollection as any}
        cluster
        clusterRadius={44}
        clusterMaxZoomLevel={15}
        onPress={handleNativePointPress}
        hitbox={{ width: 44, height: 44 }}
      >
        <MapLibre.CircleLayer
          id="request-clusters"
          filter={['has', 'point_count'] as any}
          style={clusterCircleStyle}
        />
        <MapLibre.SymbolLayer
          id="request-cluster-count"
          filter={['has', 'point_count'] as any}
          style={clusterCountStyle}
        />
        <MapLibre.CircleLayer
          id="request-points"
          filter={['!', ['has', 'point_count']] as any}
          style={unclusteredPointStyle}
        />
      </MapLibre.ShapeSource>
    </MapLibre.MapView>
  );
}

const styles = StyleSheet.create({
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
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import type { MapPoint } from '../utils/api';

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

const ASTANA_CENTER: [number, number] = [71.4306, 51.1282];
const CLUSTER_COLOR = 'rgba(255, 107, 0, 0.9)';
const MARKER_COLOR = 'rgba(51, 65, 85, 0.86)';
const MARKER_STROKE = 'rgba(255,255,255,0.92)';
const MY_MARKER_STROKE = 'rgba(15, 23, 42, 0.92)';
const CAMERA_ANIMATION = 'flyTo';
const DENSITY_HEAT_WEIGHT = 0.65;
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
  focusPoints?: MapPoint[] | null;
  renderMode?: 'markers' | 'heatmap';
  heatmapColorMode?: 'density' | 'priority';
};

function getPriorityWeight(point: MapPoint) {
  if (point.priority === 'high') return 1;
  if (point.priority === 'medium') return 0.85;
  if (point.priority === 'low') return 0.72;
  return 0.68;
}

function getHeatmapWeight(point: MapPoint, colorMode: 'density' | 'priority') {
  return colorMode === 'density' ? DENSITY_HEAT_WEIGHT : getPriorityWeight(point);
}

function getPriorityHeatColor(point: MapPoint) {
  const weight = getPriorityWeight(point);

  if (weight >= 0.98) return 'rgba(153, 27, 27, 0.72)';
  if (weight >= 0.82) return 'rgba(249, 115, 22, 0.62)';
  if (weight >= 0.72) return 'rgba(250, 204, 21, 0.54)';
  return 'rgba(254, 240, 138, 0.44)';
}

export function RequestsMap({
  points,
  categoryColors: _categoryColors,
  statusColors,
  onPointPress,
  focusPoints,
  renderMode = 'markers',
  heatmapColorMode = 'priority',
}: RequestsMapProps) {
  const { t } = useTranslation();
  const cameraRef = useRef<any>(null);
  const shapeSourceRef = useRef<any>(null);
  const [canShowUserLocation, setCanShowUserLocation] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Location.getForegroundPermissionsAsync()
      .then(({ status }) => {
        if (isMounted) {
          setCanShowUserLocation(status === 'granted');
        }
      })
      .catch(() => {
        if (isMounted) {
          setCanShowUserLocation(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const pointFeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: points.map((point) => ({
        type: 'Feature',
        id: point.id,
        properties: {
          pointId: point.id,
          status: point.status,
          is_mine: point.is_mine ? 1 : 0,
          color: statusColors[point.status] || MARKER_COLOR,
          strokeColor: point.is_mine ? MY_MARKER_STROKE : MARKER_STROKE,
          radius: 8.5,
          weight: getHeatmapWeight(point, heatmapColorMode),
          heatColor: getPriorityHeatColor(point),
        },
        geometry: {
          type: 'Point',
          coordinates: [point.lng, point.lat],
        },
      })),
    }),
    [heatmapColorMode, points, statusColors],
  );

  const heatmapLayerStyle = useMemo(
    () =>
      ({
        heatmapWeight: ['coalesce', ['get', 'weight'], DENSITY_HEAT_WEIGHT],
        heatmapIntensity: ['interpolate', ['linear'], ['zoom'], 10, 1.65, 15, 3.15],
        heatmapRadius: ['interpolate', ['linear'], ['zoom'], 10, 38, 15, 82],
        heatmapOpacity: 0.88,
        heatmapColor: [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(254, 249, 195, 0)',
          0.015,
          'rgba(254, 240, 138, 0.38)',
          0.09,
          'rgba(253, 224, 71, 0.52)',
          0.2,
          'rgba(250, 204, 21, 0.64)',
          0.36,
          'rgba(251, 146, 60, 0.76)',
          0.54,
          'rgba(249, 115, 22, 0.84)',
          0.72,
          'rgba(239, 68, 68, 0.92)',
          0.88,
          'rgba(153, 27, 27, 0.95)',
          1,
          'rgba(69, 10, 10, 0.96)',
        ],
      }) as any,
    [],
  );

  const priorityHeatmapStyle = useMemo(
    () =>
      ({
        circleColor: ['coalesce', ['get', 'heatColor'], 'rgba(254, 240, 138, 0.44)'],
        circleRadius: ['interpolate', ['linear'], ['coalesce', ['get', 'weight'], 0.68], 0.68, 36, 0.85, 52, 1, 68],
        circleBlur: 0.92,
        circleOpacity: 0.9,
        circleStrokeWidth: 0,
      }) as any,
    [],
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
          14,
          10,
          18,
          25,
          22,
        ],
        circleStrokeColor: MARKER_STROKE,
        circleStrokeWidth: 2.5,
        circleOpacity: 1,
      }) as any,
    [],
  );

  const clusterCountStyle = useMemo(
    () =>
      ({
        textField: ['get', 'point_count_abbreviated'],
        textSize: 11,
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
        circleStrokeColor: ['coalesce', ['get', 'strokeColor'], MARKER_STROKE],
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
        const coordinates = feature.geometry?.coordinates;

        if (Array.isArray(coordinates) && coordinates.length >= 2) {
          let zoomLevel = 14;

          try {
            const clusterZoom = await shapeSourceRef.current?.getClusterExpansionZoom(feature);
            if (typeof clusterZoom === 'number' && Number.isFinite(clusterZoom)) {
              zoomLevel = Math.min(clusterZoom + 0.35, 16);
            }
          } catch (error) {
            console.warn('Unable to expand request cluster', error);
          }

          cameraRef.current?.setCamera({
            centerCoordinate: [coordinates[0], coordinates[1]],
            zoomLevel,
            animationMode: CAMERA_ANIMATION,
            animationDuration: 650,
          });
        }
        return;
      }

      const pointId = feature.properties?.pointId;
      if (!pointId) return;

      const point = points.find((item) => item.id === pointId);
      if (point) {
        cameraRef.current?.setCamera({
          centerCoordinate: [point.lng, point.lat],
          zoomLevel: 15,
          animationMode: CAMERA_ANIMATION,
          animationDuration: 500,
        });
        onPointPress(point);
      }
    },
    [onPointPress, points],
  );

  useEffect(() => {
    if (!MapLibre) return;
    if (!cameraRef.current) return;

    if (focusPoints?.length) return;

    const validPoints = points.filter((point) => (
      Number.isFinite(point.lng) && Number.isFinite(point.lat)
    ));

    if (validPoints.length === 0) {
      cameraRef.current.setCamera({
        centerCoordinate: ASTANA_CENTER,
        zoomLevel: 11.5,
        animationMode: CAMERA_ANIMATION,
        animationDuration: 600,
      });
      return;
    }

    const lngs = validPoints.map((point) => point.lng);
    const lats = validPoints.map((point) => point.lat);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const isSingleCoordinate = Math.abs(maxLng - minLng) < 0.0001 && Math.abs(maxLat - minLat) < 0.0001;

    if (validPoints.length === 1 || isSingleCoordinate) {
      const point = validPoints[0];
      cameraRef.current.setCamera({
        centerCoordinate: [point.lng, point.lat],
        zoomLevel: 14.5,
        animationMode: CAMERA_ANIMATION,
        animationDuration: 600,
      });
      return;
    }

    cameraRef.current.fitBounds(
      [maxLng, maxLat],
      [minLng, minLat],
      96,
      700,
    );
  }, [focusPoints, points]);

  useEffect(() => {
    if (!MapLibre) return;
    if (!cameraRef.current) return;
    if (!focusPoints?.length) return;

    const validPoints = focusPoints.filter((point) => (
      Number.isFinite(point.lng) && Number.isFinite(point.lat)
    ));

    if (validPoints.length === 0) return;

    const lngs = validPoints.map((point) => point.lng);
    const lats = validPoints.map((point) => point.lat);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const isSingleCoordinate = Math.abs(maxLng - minLng) < 0.0001 && Math.abs(maxLat - minLat) < 0.0001;

    if (validPoints.length === 1 || isSingleCoordinate) {
      cameraRef.current.setCamera({
        centerCoordinate: [validPoints[0].lng, validPoints[0].lat],
        zoomLevel: 15,
        animationMode: CAMERA_ANIMATION,
        animationDuration: 600,
      });
      return;
    }

    cameraRef.current.fitBounds(
      [maxLng, maxLat],
      [minLng, minLat],
      96,
      700,
    );
  }, [focusPoints]);

  if (!MapLibre) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>{t('map.devBuildRequiredTitle')}</Text>
        <Text style={styles.fallbackText}>{t('map.devBuildRequiredRequests')}</Text>
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

      {canShowUserLocation ? (
        <MapLibre.UserLocation visible renderMode="normal" />
      ) : null}

      <MapLibre.ShapeSource
        ref={shapeSourceRef}
        id="requests"
        shape={pointFeatureCollection as any}
        cluster={renderMode !== 'heatmap'}
        clusterRadius={40}
        clusterMaxZoomLevel={15}
        onPress={handleNativePointPress}
        hitbox={{ width: 44, height: 44 }}
      >
        {renderMode === 'heatmap' && heatmapColorMode === 'density' ? (
          <MapLibre.HeatmapLayer id="request-heatmap" sourceID="requests" style={heatmapLayerStyle} />
        ) : null}
        {renderMode === 'heatmap' && heatmapColorMode === 'priority' ? (
          <MapLibre.CircleLayer id="request-priority-heatmap" sourceID="requests" style={priorityHeatmapStyle} />
        ) : null}
        {renderMode !== 'heatmap' ? (
          <MapLibre.CircleLayer
            id="request-clusters"
            sourceID="requests"
            filter={['has', 'point_count'] as any}
            style={clusterCircleStyle}
          />
        ) : null}
        {renderMode !== 'heatmap' ? (
          <MapLibre.SymbolLayer
            id="request-cluster-count"
            sourceID="requests"
            filter={['has', 'point_count'] as any}
            style={clusterCountStyle}
          />
        ) : null}
        {renderMode !== 'heatmap' ? (
          <MapLibre.CircleLayer
            id="request-points"
            sourceID="requests"
            filter={['!', ['has', 'point_count']] as any}
            style={unclusteredPointStyle}
          />
        ) : null}
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

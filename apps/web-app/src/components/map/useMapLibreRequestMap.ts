import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CivicRequest, MapMode } from "../../types/platform";
import {
  ASTANA_CENTER,
  buildRequestFeatureCollection,
  getFilteredRequests,
  type RequestMapPalette,
  REQUEST_MAP_STYLE,
} from "./requestMapConfig";

const RAW_SOURCE_ID = "requests-raw";
const CLUSTER_SOURCE_ID = "requests-clusters";
const POINT_LAYER_ID = "request-points";
const HEATMAP_LAYER_ID = "request-heatmap";
const CLUSTER_LAYER_ID = "request-clusters";
const CLUSTER_COUNT_LAYER_ID = "request-cluster-count";
const UNCLUSTERED_LAYER_ID = "request-unclustered-points";
const CLUSTER_COLOR = "rgba(255, 149, 0, 0.92)";
const DEFAULT_STROKE_COLOR = "rgba(255,255,255,0.92)";

type UseMapLibreRequestMapOptions = {
  requests: CivicRequest[];
  currentUserId?: string;
  mode: MapMode;
  onSelectRequest?: (request: CivicRequest) => void;
  focusRequestId?: string | null;
  palette: RequestMapPalette;
  mineRadius: number;
  defaultRadius: number;
  clustered?: boolean;
  fitToData?: boolean;
};

function setLayerVisibility(map: maplibregl.Map, layerId: string, isVisible: boolean) {
  if (!map.getLayer(layerId)) {
    return;
  }

  map.setLayoutProperty(layerId, "visibility", isVisible ? "visible" : "none");
}

function getInteractiveLayerIds(map: maplibregl.Map, clustered: boolean) {
  const layerIds = clustered
    ? [CLUSTER_LAYER_ID, CLUSTER_COUNT_LAYER_ID, UNCLUSTERED_LAYER_ID]
    : [POINT_LAYER_ID];

  return layerIds.filter((layerId) => map.getLayer(layerId));
}

function addMapLayers(map: maplibregl.Map, clustered: boolean) {
  map.addSource(RAW_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  if (clustered) {
    map.addSource(CLUSTER_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterMaxZoom: 15,
      clusterRadius: 44,
    });
  }

  map.addLayer({
    id: HEATMAP_LAYER_ID,
    type: "heatmap",
    source: RAW_SOURCE_ID,
    paint: {
      "heatmap-weight": ["coalesce", ["get", "weight"], 0.4],
      "heatmap-intensity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        0.95,
        15,
        1.45,
      ],
      "heatmap-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        28,
        15,
        58,
      ],
      "heatmap-opacity": 0.74,
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(8, 145, 178, 0)",
        0.08,
        "rgba(6, 182, 212, 0.34)",
        0.22,
        "rgba(45, 212, 191, 0.55)",
        0.38,
        "rgba(132, 204, 22, 0.6)",
        0.54,
        "rgba(250, 204, 21, 0.68)",
        0.7,
        "rgba(251, 146, 60, 0.74)",
        0.84,
        "rgba(239, 68, 68, 0.84)",
        0.94,
        "rgba(220, 38, 38, 0.9)",
        1,
        "rgba(185, 28, 28, 0.94)",
      ],
    },
  });

  if (clustered) {
    map.addLayer({
      id: CLUSTER_LAYER_ID,
      type: "circle",
      source: CLUSTER_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": CLUSTER_COLOR,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "point_count"],
          1,
          16,
          10,
          20,
          25,
          24,
        ],
        "circle-stroke-color": DEFAULT_STROKE_COLOR,
        "circle-stroke-width": 3,
      },
    });

    map.addLayer({
      id: CLUSTER_COUNT_LAYER_ID,
      type: "symbol",
      source: CLUSTER_SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 12,
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
      },
      paint: {
        "text-color": "#ffffff",
      },
    });

    map.addLayer({
      id: UNCLUSTERED_LAYER_ID,
      type: "circle",
      source: CLUSTER_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["coalesce", ["get", "color"], "#f47b20"],
        "circle-radius": ["coalesce", ["get", "radius"], 8],
        "circle-stroke-color": ["coalesce", ["get", "strokeColor"], DEFAULT_STROKE_COLOR],
        "circle-stroke-width": 3,
      },
    });
  } else {
    map.addLayer({
      id: POINT_LAYER_ID,
      type: "circle",
      source: RAW_SOURCE_ID,
      paint: {
        "circle-color": ["coalesce", ["get", "color"], "#f47b20"],
        "circle-radius": ["coalesce", ["get", "radius"], 6],
        "circle-stroke-color": ["coalesce", ["get", "strokeColor"], DEFAULT_STROKE_COLOR],
        "circle-stroke-width": 2,
      },
    });
  }
}

function fitMapToRequests(
  map: maplibregl.Map,
  requests: CivicRequest[],
  fitToData: boolean,
) {
  if (!fitToData) {
    return;
  }

  if (requests.length === 0) {
    map.flyTo({ center: ASTANA_CENTER, zoom: 11.5, duration: 550, essential: true });
    return;
  }

  const coordinates = requests.map((request) => ([
    request.point.lng || ASTANA_CENTER[0],
    request.point.lat || ASTANA_CENTER[1],
  ] as [number, number]));

  const lngs = coordinates.map(([lng]) => lng);
  const lats = coordinates.map(([, lat]) => lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const isSingleCoordinate = Math.abs(maxLng - minLng) < 0.0001 && Math.abs(maxLat - minLat) < 0.0001;

  if (requests.length === 1 || isSingleCoordinate) {
    map.flyTo({
      center: coordinates[0],
      zoom: 14.75,
      duration: 650,
      essential: true,
    });
    return;
  }

  const bounds = coordinates.reduce(
    (accumulator, coordinate) => accumulator.extend(coordinate),
    new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
  );

  map.stop();

  map.fitBounds(bounds, {
    padding: 56,
    duration: 700,
    maxZoom: 15,
    essential: true,
  });
}

function getFitSignature(requests: CivicRequest[]) {
  return requests
    .map((request) => `${request.id}:${request.point.lng || ASTANA_CENTER[0]}:${request.point.lat || ASTANA_CENTER[1]}`)
    .join("|");
}

export function useMapLibreRequestMap({
  requests,
  currentUserId,
  mode,
  onSelectRequest,
  focusRequestId,
  palette,
  mineRadius,
  defaultRadius,
  clustered = false,
  fitToData = true,
}: UseMapLibreRequestMapOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const fitSignatureRef = useRef<string | null>(null);
  const filteredRequests = useMemo(
    () => getFilteredRequests(requests, currentUserId, mode),
    [requests, currentUserId, mode],
  );
  const filteredRequestsRef = useRef(filteredRequests);
  const featureCollection = useMemo(
    () =>
      buildRequestFeatureCollection(
        filteredRequests,
        currentUserId,
        palette,
        mineRadius,
        defaultRadius,
      ),
    [currentUserId, defaultRadius, filteredRequests, mineRadius, palette],
  );
  const handleSelectRequest = useEffectEvent((request: CivicRequest) => onSelectRequest?.(request));

  useEffect(() => {
    filteredRequestsRef.current = filteredRequests;
  }, [filteredRequests]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: REQUEST_MAP_STYLE,
      center: ASTANA_CENTER,
      zoom: 11.5,
      attributionControl: false,
      dragRotate: false,
      touchPitch: false,
      touchZoomRotate: false,
      doubleClickZoom: true,
    });

    mapRef.current = map;

    const handleClick = (event: maplibregl.MapMouseEvent) => {
      const layers = getInteractiveLayerIds(map, clustered);
      if (layers.length === 0) {
        return;
      }

      const features = map.queryRenderedFeatures(event.point, {
        layers,
      });
      const feature = features[0];

      if (!feature) {
        return;
      }

      if (clustered && (feature.layer.id === CLUSTER_LAYER_ID || feature.layer.id === CLUSTER_COUNT_LAYER_ID)) {
        const clusterId = feature.properties?.cluster_id;
        const geometry = feature.geometry;
        const clusterSource = map.getSource(CLUSTER_SOURCE_ID) as GeoJSONSource | undefined;

        if (clusterSource && typeof clusterId !== "undefined" && geometry.type === "Point") {
          void clusterSource.getClusterExpansionZoom(Number(clusterId)).then((zoom) => {
            map.stop();
            map.flyTo({
              center: geometry.coordinates as [number, number],
              zoom: Math.min(zoom + 0.35, 16),
              duration: 650,
              essential: true,
            });
          }).catch(() => {
            map.flyTo({
              center: geometry.coordinates as [number, number],
              zoom: Math.min(map.getZoom() + 1.4, 16),
              duration: 550,
              essential: true,
            });
          });
        }

        return;
      }

      const requestId = String(feature.properties?.requestId ?? "");
      const request = filteredRequestsRef.current.find((item) => item.id === requestId);

      if (request) {
        handleSelectRequest(request);
      }
    };

    const handleMove = (event: maplibregl.MapMouseEvent) => {
      const canvas = map.getCanvas();
      const layers = getInteractiveLayerIds(map, clustered);
      if (layers.length === 0) {
        canvas.style.cursor = "";
        return;
      }

      const features = map.queryRenderedFeatures(event.point, {
        layers,
      });
      canvas.style.cursor = features.length > 0 ? "pointer" : "";
    };

    map.on("load", () => {
      addMapLayers(map, clustered);

      const rawSource = map.getSource(RAW_SOURCE_ID) as GeoJSONSource | undefined;
      rawSource?.setData(featureCollection as GeoJSON.FeatureCollection);

      if (clustered) {
        const clusterSource = map.getSource(CLUSTER_SOURCE_ID) as GeoJSONSource | undefined;
        clusterSource?.setData(featureCollection as GeoJSON.FeatureCollection);
      }

      setLayerVisibility(map, HEATMAP_LAYER_ID, mode === "heatmap");
      setLayerVisibility(map, POINT_LAYER_ID, mode !== "heatmap");
      setLayerVisibility(map, CLUSTER_LAYER_ID, mode !== "heatmap");
      setLayerVisibility(map, CLUSTER_COUNT_LAYER_ID, mode !== "heatmap");
      setLayerVisibility(map, UNCLUSTERED_LAYER_ID, mode !== "heatmap");
      fitSignatureRef.current = getFitSignature(filteredRequestsRef.current);
      fitMapToRequests(map, filteredRequestsRef.current, fitToData);
    });

    map.on("click", handleClick);
    map.on("mousemove", handleMove);

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(containerRef.current);
    requestAnimationFrame(() => map.resize());

    return () => {
      resizeObserver.disconnect();
      map.off("click", handleClick);
      map.off("mousemove", handleMove);
      map.remove();
      mapRef.current = null;
    };
  }, [clustered, featureCollection, fitToData, mode]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const rawSource = map.getSource(RAW_SOURCE_ID) as GeoJSONSource | undefined;
    rawSource?.setData(featureCollection as GeoJSON.FeatureCollection);

    if (clustered) {
      const clusterSource = map.getSource(CLUSTER_SOURCE_ID) as GeoJSONSource | undefined;
      clusterSource?.setData(featureCollection as GeoJSON.FeatureCollection);
    }

    setLayerVisibility(map, HEATMAP_LAYER_ID, mode === "heatmap");
    setLayerVisibility(map, POINT_LAYER_ID, mode !== "heatmap");
    setLayerVisibility(map, CLUSTER_LAYER_ID, mode !== "heatmap");
    setLayerVisibility(map, CLUSTER_COUNT_LAYER_ID, mode !== "heatmap");
    setLayerVisibility(map, UNCLUSTERED_LAYER_ID, mode !== "heatmap");
    const nextFitSignature = getFitSignature(filteredRequests);
    if (fitSignatureRef.current !== nextFitSignature) {
      fitSignatureRef.current = nextFitSignature;
      fitMapToRequests(map, filteredRequests, fitToData);
    }
  }, [clustered, featureCollection, filteredRequests, fitToData, mode]);

  useEffect(() => {
    const map = mapRef.current;
    const request = filteredRequests.find((item) => item.id === focusRequestId);

    if (!map || !request) {
      return;
    }

    map.stop();
    map.flyTo({
      center: [request.point.lng || ASTANA_CENTER[0], request.point.lat || ASTANA_CENTER[1]],
      zoom: Math.max(map.getZoom(), 14.5),
      duration: 580,
      essential: true,
    });
  }, [filteredRequests, focusRequestId]);

  const zoomIn = () => {
    mapRef.current?.zoomIn({ duration: 220 });
  };

  const zoomOut = () => {
    mapRef.current?.zoomOut({ duration: 220 });
  };

  const locateUser = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      mapRef.current?.flyTo({ center: ASTANA_CENTER, zoom: 12.5, duration: 450, essential: true });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        mapRef.current?.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 14.5,
          duration: 580,
          essential: true,
        });
      },
      () => {
        mapRef.current?.flyTo({ center: ASTANA_CENTER, zoom: 12.5, duration: 450, essential: true });
      },
      { enableHighAccuracy: true, timeout: 6000 },
    );
  };

  return {
    containerRef,
    zoomIn,
    zoomOut,
    locateUser,
  };
}

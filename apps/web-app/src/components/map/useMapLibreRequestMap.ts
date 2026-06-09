import { useEffect, useEffectEvent, useMemo, useRef, type MutableRefObject } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CivicRequest, MapMode } from "../../types/platform";
import {
  ASTANA_CENTER,
  buildRequestFeatureCollection,
  getFilteredRequests,
  getHeatmapWeight,
  getRequestColor,
  getRequestCoordinate,
  getRequestWeight,
  getRequestStrokeColor,
  type HeatmapColorMode,
  type RequestMapPalette,
  REQUEST_MAP_STYLE,
} from "./requestMapConfig";

const RAW_SOURCE_ID = "requests-raw";
const CLUSTER_SOURCE_ID = "requests-clusters";
const POINT_LAYER_ID = "request-points";
const HEATMAP_LAYER_ID = "request-heatmap";
const HEATMAP_HALO_LAYER_ID = "request-heatmap-halos";
const CLUSTER_LAYER_ID = "request-clusters";
const CLUSTER_COUNT_LAYER_ID = "request-cluster-count";
const UNCLUSTERED_LAYER_ID = "request-unclustered-points";
const REQUEST_MARKER_CLASS = "request-dom-marker";
const HEATMAP_BLOB_CLASS = "request-heatmap-blob";
const CLUSTER_COLOR = "rgba(255, 149, 0, 0.92)";
const DEFAULT_STROKE_COLOR = "rgba(255,255,255,0.92)";
const HEATMAP_DENSITY_RADIUS_METERS = 1900;

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
  heatmapColorMode?: HeatmapColorMode;
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
        1.65,
        15,
        3.15,
      ],
      "heatmap-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        38,
        15,
        82,
      ],
      "heatmap-opacity": 0.88,
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(254, 249, 195, 0)",
        0.015,
        "rgba(254, 240, 138, 0.38)",
        0.09,
        "rgba(253, 224, 71, 0.52)",
        0.2,
        "rgba(250, 204, 21, 0.64)",
        0.36,
        "rgba(251, 146, 60, 0.76)",
        0.54,
        "rgba(249, 115, 22, 0.84)",
        0.72,
        "rgba(239, 68, 68, 0.92)",
        0.88,
        "rgba(153, 27, 27, 0.95)",
        1,
        "rgba(69, 10, 10, 0.96)",
      ],
    },
  });

  map.addLayer({
    id: HEATMAP_HALO_LAYER_ID,
    type: "circle",
    source: RAW_SOURCE_ID,
    paint: {
      "circle-color": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "weight"], 0.7],
        0.65,
        "rgba(254, 240, 138, 0.32)",
        0.85,
        "rgba(251, 146, 60, 0.36)",
        1,
        "rgba(153, 27, 27, 0.42)",
      ],
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        18,
        13,
        32,
        15,
        46,
      ],
      "circle-blur": 0.9,
      "circle-opacity": 0.78,
      "circle-stroke-width": 0,
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

    try {
      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: "symbol",
        source: CLUSTER_SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": ["Open Sans Semibold"],
        },
        paint: {
          "text-color": "#ffffff",
        },
      });
    } catch (error) {
      console.warn("Map cluster labels could not be initialized.", error);
    }
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

function createRequestMarkerElement(
  request: CivicRequest,
  currentUserId: string | undefined,
  palette: RequestMapPalette,
  mineRadius: number,
  defaultRadius: number,
) {
  const radius = request.citizenId === currentUserId ? mineRadius : defaultRadius;
  const size = Math.max(radius * 2, 16);
  const element = document.createElement("button");
  element.type = "button";
  element.className = REQUEST_MARKER_CLASS;
  element.setAttribute("aria-label", request.title || request.address || "Request marker");
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
  element.style.borderRadius = "999px";
  element.style.border = "3px solid";
  element.style.borderColor = getRequestStrokeColor(request, currentUserId, palette);
  element.style.background = getRequestColor(request, palette);
  element.style.boxShadow = "0 8px 20px rgba(15, 23, 42, 0.28)";
  element.style.cursor = "pointer";
  element.style.position = "absolute";
  element.style.transform = "translate(-50%, -50%)";
  element.style.zIndex = "2";
  element.style.padding = "0";
  element.style.pointerEvents = "auto";
  return element;
}

function clearDomMarkers(markerRefs: MutableRefObject<globalThis.Map<string, HTMLButtonElement>>) {
  markerRefs.current.forEach((marker) => marker.remove());
  markerRefs.current.clear();
}

function clearHeatmapBlobs(blobRefs: MutableRefObject<globalThis.Map<string, HTMLDivElement>>) {
  blobRefs.current.forEach((blob) => blob.remove());
  blobRefs.current.clear();
}

function ensureMarkerOverlay(
  container: HTMLDivElement,
  overlayRef: MutableRefObject<HTMLDivElement | null>,
) {
  if (overlayRef.current && overlayRef.current.isConnected) {
    return overlayRef.current;
  }

  const overlay = document.createElement("div");
  overlay.className = "request-marker-overlay";
  container.appendChild(overlay);
  overlayRef.current = overlay;
  return overlay;
}

function positionDomMarker(map: maplibregl.Map, marker: HTMLButtonElement, request: CivicRequest) {
  const point = map.project(getRequestCoordinate(request));
  marker.style.left = `${point.x}px`;
  marker.style.top = `${point.y}px`;
}

function getApproxDistanceMeters(first: CivicRequest, second: CivicRequest) {
  const firstLat = first.point.lat || ASTANA_CENTER[1];
  const firstLng = first.point.lng || ASTANA_CENTER[0];
  const secondLat = second.point.lat || ASTANA_CENTER[1];
  const secondLng = second.point.lng || ASTANA_CENTER[0];
  const latMeters = (firstLat - secondLat) * 111_320;
  const lngMeters = (firstLng - secondLng) * 111_320 * Math.cos((firstLat * Math.PI) / 180);

  return Math.hypot(latMeters, lngMeters);
}

function getHeatmapBlobDensityLevels(requests: CivicRequest[]) {
  const rawScores = requests.map((request) => {
    const neighborScore = requests.reduce((total, candidate) => {
      if (candidate.id === request.id) {
        return total;
      }

      const distance = getApproxDistanceMeters(request, candidate);

      if (distance > HEATMAP_DENSITY_RADIUS_METERS) {
        return total;
      }

      const closeness = 1 - distance / HEATMAP_DENSITY_RADIUS_METERS;
      return total + closeness * closeness;
    }, 0);

    return { id: request.id, score: neighborScore };
  });
  const maxScore = Math.max(...rawScores.map((item) => item.score), 0);
  const levels = new Map<string, number>();

  rawScores.forEach(({ id, score }) => {
    levels.set(id, maxScore > 0 ? score / maxScore : 0);
  });

  return levels;
}

function setDensityBlobPalette(element: HTMLDivElement, densityLevel: number) {
  if (densityLevel >= 0.82) {
    element.style.setProperty("--heatmap-blob-core", "69, 10, 10");
    element.style.setProperty("--heatmap-blob-mid", "153, 27, 27");
    element.style.setProperty("--heatmap-blob-edge", "249, 115, 22");
  } else if (densityLevel >= 0.58) {
    element.style.setProperty("--heatmap-blob-core", "153, 27, 27");
    element.style.setProperty("--heatmap-blob-mid", "239, 68, 68");
    element.style.setProperty("--heatmap-blob-edge", "251, 146, 60");
  } else if (densityLevel >= 0.34) {
    element.style.setProperty("--heatmap-blob-core", "249, 115, 22");
    element.style.setProperty("--heatmap-blob-mid", "251, 146, 60");
    element.style.setProperty("--heatmap-blob-edge", "250, 204, 21");
  } else if (densityLevel >= 0.12) {
    element.style.setProperty("--heatmap-blob-core", "250, 204, 21");
    element.style.setProperty("--heatmap-blob-mid", "253, 224, 71");
    element.style.setProperty("--heatmap-blob-edge", "254, 240, 138");
  } else {
    element.style.setProperty("--heatmap-blob-core", "254, 240, 138");
    element.style.setProperty("--heatmap-blob-mid", "254, 249, 195");
    element.style.setProperty("--heatmap-blob-edge", "254, 252, 232");
  }
}

function createHeatmapBlobElement(
  request: CivicRequest,
  heatmapColorMode: HeatmapColorMode,
  densityLevel = 0,
) {
  const weight = getHeatmapWeight(request, heatmapColorMode);
  const size = heatmapColorMode === "density"
    ? Math.round(112 + densityLevel * 52)
    : Math.round(78 + getRequestWeight(request) * 74);
  const element = document.createElement("div");
  element.className = HEATMAP_BLOB_CLASS;
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
  element.style.setProperty(
    "--heatmap-blob-opacity",
    String(heatmapColorMode === "density" ? 0.42 + densityLevel * 0.24 : 0.5 + weight * 0.16),
  );

  if (heatmapColorMode === "density") {
    setDensityBlobPalette(element, densityLevel);
  } else if (weight >= 0.98) {
    element.style.setProperty("--heatmap-blob-core", "153, 27, 27");
    element.style.setProperty("--heatmap-blob-mid", "239, 68, 68");
    element.style.setProperty("--heatmap-blob-edge", "251, 146, 60");
  } else if (weight >= 0.82) {
    element.style.setProperty("--heatmap-blob-core", "249, 115, 22");
    element.style.setProperty("--heatmap-blob-mid", "251, 146, 60");
    element.style.setProperty("--heatmap-blob-edge", "250, 204, 21");
  } else if (weight >= 0.72) {
    element.style.setProperty("--heatmap-blob-core", "250, 204, 21");
    element.style.setProperty("--heatmap-blob-mid", "253, 224, 71");
    element.style.setProperty("--heatmap-blob-edge", "254, 240, 138");
  } else {
    element.style.setProperty("--heatmap-blob-core", "254, 240, 138");
    element.style.setProperty("--heatmap-blob-mid", "254, 249, 195");
    element.style.setProperty("--heatmap-blob-edge", "254, 252, 232");
  }

  return element;
}

function positionHeatmapBlob(map: maplibregl.Map, blob: HTMLDivElement, request: CivicRequest) {
  const point = map.project(getRequestCoordinate(request));
  blob.style.left = `${point.x}px`;
  blob.style.top = `${point.y}px`;
}

function positionHeatmapBlobs(
  map: maplibregl.Map,
  blobRefs: MutableRefObject<globalThis.Map<string, HTMLDivElement>>,
  requests: CivicRequest[],
) {
  const requestById = new Map(requests.map((request) => [request.id, request]));

  blobRefs.current.forEach((blob, requestId) => {
    const request = requestById.get(requestId);
    if (request) {
      positionHeatmapBlob(map, blob, request);
    }
  });
}

function positionDomMarkers(
  map: maplibregl.Map,
  markerRefs: MutableRefObject<globalThis.Map<string, HTMLButtonElement>>,
  requests: CivicRequest[],
) {
  const requestById = new Map(requests.map((request) => [request.id, request]));

  markerRefs.current.forEach((marker, requestId) => {
    const request = requestById.get(requestId);
    if (request) {
      positionDomMarker(map, marker, request);
    }
  });
}

function syncDomMarkers(
  map: maplibregl.Map,
  overlayRef: MutableRefObject<HTMLDivElement | null>,
  markerRefs: MutableRefObject<globalThis.Map<string, HTMLButtonElement>>,
  requests: CivicRequest[],
  currentUserId: string | undefined,
  mode: MapMode,
  palette: RequestMapPalette,
  mineRadius: number,
  defaultRadius: number,
  onSelect: (request: CivicRequest) => void,
) {
  clearDomMarkers(markerRefs);
  const overlay = overlayRef.current;

  if (mode === "heatmap" || !overlay) {
    return;
  }

  for (const request of requests) {
    const element = createRequestMarkerElement(request, currentUserId, palette, mineRadius, defaultRadius);
    positionDomMarker(map, element, request);
    element.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect(request);
    });

    overlay.appendChild(element);
    markerRefs.current.set(request.id, element);
  }
}

function syncHeatmapBlobs(
  map: maplibregl.Map,
  overlayRef: MutableRefObject<HTMLDivElement | null>,
  blobRefs: MutableRefObject<globalThis.Map<string, HTMLDivElement>>,
  requests: CivicRequest[],
  mode: MapMode,
  heatmapColorMode: HeatmapColorMode,
) {
  clearHeatmapBlobs(blobRefs);
  const overlay = overlayRef.current;

  if (mode !== "heatmap" || !overlay) {
    return;
  }

  const densityLevels = heatmapColorMode === "density" ? getHeatmapBlobDensityLevels(requests) : new Map<string, number>();

  for (const request of requests) {
    const element = createHeatmapBlobElement(request, heatmapColorMode, densityLevels.get(request.id) ?? 0);
    positionHeatmapBlob(map, element, request);
    overlay.appendChild(element);
    blobRefs.current.set(request.id, element);
  }
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
  heatmapColorMode = "priority",
}: UseMapLibreRequestMapOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const markerRefs = useRef<globalThis.Map<string, HTMLButtonElement>>(new Map());
  const heatmapBlobRefs = useRef<globalThis.Map<string, HTMLDivElement>>(new Map());
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
        heatmapColorMode,
      ),
    [currentUserId, defaultRadius, filteredRequests, heatmapColorMode, mineRadius, palette],
  );
  const featureCollectionRef = useRef(featureCollection);
  const handleSelectRequest = useEffectEvent((request: CivicRequest) => onSelectRequest?.(request));

  useEffect(() => {
    filteredRequestsRef.current = filteredRequests;
    featureCollectionRef.current = featureCollection;
  }, [featureCollection, filteredRequests]);

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
    ensureMarkerOverlay(containerRef.current, overlayRef);

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

    const handleMarkerPositionUpdate = () => {
      positionDomMarkers(map, markerRefs, filteredRequestsRef.current);
      positionHeatmapBlobs(map, heatmapBlobRefs, filteredRequestsRef.current);
    };

    map.on("load", () => {
      addMapLayers(map, clustered);

      const rawSource = map.getSource(RAW_SOURCE_ID) as GeoJSONSource | undefined;
      rawSource?.setData(featureCollectionRef.current as GeoJSON.FeatureCollection);

      if (clustered) {
        const clusterSource = map.getSource(CLUSTER_SOURCE_ID) as GeoJSONSource | undefined;
        clusterSource?.setData(featureCollectionRef.current as GeoJSON.FeatureCollection);
      }

      setLayerVisibility(map, HEATMAP_LAYER_ID, mode === "heatmap");
      setLayerVisibility(map, HEATMAP_HALO_LAYER_ID, mode === "heatmap");
      setLayerVisibility(map, POINT_LAYER_ID, mode !== "heatmap");
      setLayerVisibility(map, CLUSTER_LAYER_ID, mode !== "heatmap");
      setLayerVisibility(map, CLUSTER_COUNT_LAYER_ID, mode !== "heatmap");
      setLayerVisibility(map, UNCLUSTERED_LAYER_ID, mode !== "heatmap");
      syncDomMarkers(
        map,
        overlayRef,
        markerRefs,
        filteredRequestsRef.current,
        currentUserId,
        mode,
        palette,
        mineRadius,
        defaultRadius,
        handleSelectRequest,
      );
      syncHeatmapBlobs(
        map,
        overlayRef,
        heatmapBlobRefs,
        filteredRequestsRef.current,
        mode,
        heatmapColorMode,
      );
      fitSignatureRef.current = getFitSignature(filteredRequestsRef.current);
      fitMapToRequests(map, filteredRequestsRef.current, fitToData);
    });

    map.on("click", handleClick);
    map.on("mousemove", handleMove);
    map.on("move", handleMarkerPositionUpdate);
    map.on("resize", handleMarkerPositionUpdate);

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
      handleMarkerPositionUpdate();
    });
    resizeObserver.observe(containerRef.current);
    requestAnimationFrame(() => map.resize());

    return () => {
      resizeObserver.disconnect();
      map.off("click", handleClick);
      map.off("mousemove", handleMove);
      map.off("move", handleMarkerPositionUpdate);
      map.off("resize", handleMarkerPositionUpdate);
      clearDomMarkers(markerRefs);
      clearHeatmapBlobs(heatmapBlobRefs);
      overlayRef.current?.remove();
      overlayRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [clustered, currentUserId, defaultRadius, fitToData, handleSelectRequest, heatmapColorMode, mineRadius, mode, palette]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const rawSource = map.getSource(RAW_SOURCE_ID) as GeoJSONSource | undefined;
    rawSource?.setData(featureCollection as GeoJSON.FeatureCollection);

    if (clustered) {
      const clusterSource = map.getSource(CLUSTER_SOURCE_ID) as GeoJSONSource | undefined;
      clusterSource?.setData(featureCollection as GeoJSON.FeatureCollection);
    }

    setLayerVisibility(map, HEATMAP_LAYER_ID, mode === "heatmap");
    setLayerVisibility(map, HEATMAP_HALO_LAYER_ID, mode === "heatmap");
    setLayerVisibility(map, POINT_LAYER_ID, mode !== "heatmap");
    setLayerVisibility(map, CLUSTER_LAYER_ID, mode !== "heatmap");
    setLayerVisibility(map, CLUSTER_COUNT_LAYER_ID, mode !== "heatmap");
    setLayerVisibility(map, UNCLUSTERED_LAYER_ID, mode !== "heatmap");
    syncDomMarkers(
      map,
      overlayRef,
      markerRefs,
      filteredRequests,
      currentUserId,
      mode,
      palette,
      mineRadius,
      defaultRadius,
      handleSelectRequest,
    );
    syncHeatmapBlobs(
      map,
      overlayRef,
      heatmapBlobRefs,
      filteredRequests,
      mode,
      heatmapColorMode,
    );
    const nextFitSignature = getFitSignature(filteredRequests);
    if (fitSignatureRef.current !== nextFitSignature) {
      fitSignatureRef.current = nextFitSignature;
      fitMapToRequests(map, filteredRequests, fitToData);
    }
  }, [clustered, currentUserId, defaultRadius, featureCollection, filteredRequests, fitToData, handleSelectRequest, heatmapColorMode, mineRadius, mode, palette]);

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

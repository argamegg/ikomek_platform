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
import {
  buildDistrictFeatureCollection,
  CITY_DISTRICT_ID,
  getDistrictBounds,
} from "./mapDistricts";
import type { MapLayerState } from "../../web/lib/mapDashboard";

const RAW_SOURCE_ID = "requests-raw";
const CLUSTER_SOURCE_ID = "requests-clusters";
const DISTRICT_SOURCE_ID = "astana-districts";
const POINT_LAYER_ID = "request-points";
const CRITICAL_PULSE_LAYER_ID = "request-critical-pulse";
const SELECTED_REQUEST_LAYER_ID = "request-selected-ring";
const HEATMAP_LAYER_ID = "request-heatmap";
const CLUSTER_LAYER_ID = "request-clusters";
const CLUSTER_COUNT_LAYER_ID = "request-cluster-count";
const UNCLUSTERED_LAYER_ID = "request-unclustered-points";
const DISTRICT_FILL_LAYER_ID = "astana-district-fill";
const DISTRICT_OUTLINE_LAYER_ID = "astana-district-outline";
const DISTRICT_SELECTED_LAYER_ID = "astana-district-selected";
const DISTRICT_HOVER_LAYER_ID = "astana-district-hover";
const DISTRICT_SELECTED_GLOW_LAYER_ID = "astana-district-selected-glow";
const DISTRICT_SELECTED_BORDER_LAYER_ID = "astana-district-selected-border";

type MapPadding = number | { top: number; right: number; bottom: number; left: number };

type UseMapLibreRequestMapOptions = {
  requests: CivicRequest[];
  districtRequests?: CivicRequest[];
  currentUserId?: string;
  mode: MapMode;
  layers?: MapLayerState;
  selectedDistrictId?: string;
  selectedRequestId?: string | null;
  onSelectRequest?: (request: CivicRequest) => void;
  onSelectDistrict?: (districtId: string) => void;
  palette: RequestMapPalette;
  mineRadius: number;
  defaultRadius: number;
  clustered?: boolean;
  fitToData?: boolean;
  fitPadding?: MapPadding;
};

const defaultLayers: MapLayerState = {
  markers: true,
  clusters: true,
  heatmap: false,
  districts: true,
};

const defaultFitPadding: MapPadding = 36;

function setLayerVisibility(map: maplibregl.Map, layerId: string, isVisible: boolean) {
  if (!map.getLayer(layerId)) {
    return;
  }

  map.setLayoutProperty(layerId, "visibility", isVisible ? "visible" : "none");
}

function setSourceData(
  map: maplibregl.Map,
  sourceId: string,
  data: GeoJSON.FeatureCollection,
) {
  const source = map.getSource(sourceId) as GeoJSONSource | undefined;
  source?.setData(data);
}

function getRequestInteractiveLayerIds(map: maplibregl.Map, layers: MapLayerState) {
  const layerIds = layers.clusters
    ? [CLUSTER_LAYER_ID, UNCLUSTERED_LAYER_ID]
    : [POINT_LAYER_ID];

  return layerIds.filter((layerId) => map.getLayer(layerId));
}

function syncMapLayerVisibility(map: maplibregl.Map, mode: MapMode, layers: MapLayerState) {
  const heatmapVisible = layers.heatmap || mode === "heatmap";

  setLayerVisibility(map, DISTRICT_FILL_LAYER_ID, layers.districts);
  setLayerVisibility(map, DISTRICT_OUTLINE_LAYER_ID, layers.districts);
  setLayerVisibility(map, DISTRICT_SELECTED_LAYER_ID, layers.districts);
  setLayerVisibility(map, DISTRICT_HOVER_LAYER_ID, layers.districts);
  setLayerVisibility(map, DISTRICT_SELECTED_GLOW_LAYER_ID, layers.districts);
  setLayerVisibility(map, DISTRICT_SELECTED_BORDER_LAYER_ID, layers.districts);
  setLayerVisibility(map, HEATMAP_LAYER_ID, heatmapVisible);
  setLayerVisibility(map, CLUSTER_LAYER_ID, layers.clusters);
  setLayerVisibility(map, CLUSTER_COUNT_LAYER_ID, layers.clusters);
  setLayerVisibility(map, UNCLUSTERED_LAYER_ID, layers.clusters && layers.markers);
  setLayerVisibility(map, POINT_LAYER_ID, !layers.clusters && layers.markers);
  setLayerVisibility(map, CRITICAL_PULSE_LAYER_ID, layers.markers);
  setLayerVisibility(map, SELECTED_REQUEST_LAYER_ID, layers.markers);
}

function addMapLayers(map: maplibregl.Map) {
  map.addSource(DISTRICT_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addSource(RAW_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addSource(CLUSTER_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    cluster: true,
    clusterMaxZoom: 15,
    clusterRadius: 44,
  });

  map.addLayer({
    id: DISTRICT_FILL_LAYER_ID,
    type: "fill",
    source: DISTRICT_SOURCE_ID,
    paint: {
      "fill-color": [
        "case",
        ["get", "selected"],
        "rgba(255, 107, 0, 0.34)",
        [
          "match",
          ["get", "load"],
          "low",
          "rgba(16, 185, 129, 0.15)",
          "medium",
          "rgba(245, 158, 11, 0.17)",
          "high",
          "rgba(249, 115, 22, 0.2)",
          "critical",
          "rgba(225, 29, 72, 0.22)",
          "rgba(255, 107, 0, 0.14)",
        ],
      ],
      "fill-opacity": [
        "case",
        ["get", "dimmed"],
        0.03,
        ["get", "selected"],
        0.44,
        0.16,
      ],
    },
  });

  map.addLayer({
    id: DISTRICT_OUTLINE_LAYER_ID,
    type: "line",
    source: DISTRICT_SOURCE_ID,
    paint: {
      "line-color": [
        "case",
        ["get", "dimmed"],
        "rgba(15, 23, 42, 0.12)",
        "rgba(15, 23, 42, 0.32)",
      ],
      "line-width": 1.2,
      "line-dasharray": [2, 2],
    },
  });

  map.addLayer({
    id: DISTRICT_SELECTED_LAYER_ID,
    type: "line",
    source: DISTRICT_SOURCE_ID,
    filter: ["==", ["get", "selected"], true],
    paint: {
      "line-color": "rgba(255, 107, 0, 0.95)",
      "line-width": 3,
    },
  });

  map.addLayer({
    id: DISTRICT_HOVER_LAYER_ID,
    type: "line",
    source: DISTRICT_SOURCE_ID,
    filter: ["==", ["get", "districtId"], ""],
    paint: {
      "line-color": "rgba(255, 107, 0, 0.72)",
      "line-width": 2.4,
    },
  });

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
        0.7,
        15,
        1.15,
      ],
      "heatmap-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        18,
        15,
        34,
      ],
      "heatmap-opacity": 0.85,
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(244, 123, 32, 0)",
        0.2,
        "rgba(247, 179, 111, 0.3)",
        0.5,
        "rgba(244, 123, 32, 0.65)",
        0.8,
        "rgba(225, 29, 72, 0.75)",
        1,
        "rgba(23, 49, 74, 0.85)",
      ],
    },
  });

  map.addLayer({
    id: CRITICAL_PULSE_LAYER_ID,
    type: "circle",
    source: RAW_SOURCE_ID,
    filter: ["==", ["get", "critical"], true],
    paint: {
      "circle-color": "rgba(225, 29, 72, 0.25)",
      "circle-radius": ["+", ["coalesce", ["get", "radius"], 10], 11],
      "circle-stroke-color": "rgba(225, 29, 72, 0.38)",
      "circle-stroke-width": 2,
    },
  });

  map.addLayer({
    id: CLUSTER_LAYER_ID,
    type: "circle",
    source: CLUSTER_SOURCE_ID,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "rgba(255, 107, 0, 0.88)",
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
      "circle-stroke-color": "rgba(255,255,255,0.92)",
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
      "circle-stroke-color": ["coalesce", ["get", "strokeColor"], "rgba(255,255,255,0.92)"],
      "circle-stroke-width": ["coalesce", ["get", "strokeWidth"], 3],
    },
  });

  map.addLayer({
    id: POINT_LAYER_ID,
    type: "circle",
    source: RAW_SOURCE_ID,
    paint: {
      "circle-color": ["coalesce", ["get", "color"], "#f47b20"],
      "circle-radius": ["coalesce", ["get", "radius"], 6],
      "circle-stroke-color": ["coalesce", ["get", "strokeColor"], "#ffffff"],
      "circle-stroke-width": ["coalesce", ["get", "strokeWidth"], 2],
    },
  });

  map.addLayer({
    id: SELECTED_REQUEST_LAYER_ID,
    type: "circle",
    source: RAW_SOURCE_ID,
    filter: ["==", ["get", "selected"], true],
    paint: {
      "circle-color": "rgba(255, 255, 255, 0)",
      "circle-radius": ["+", ["coalesce", ["get", "radius"], 10], 8],
      "circle-stroke-color": "rgba(15, 23, 42, 0.72)",
      "circle-stroke-width": 3,
    },
  });

  map.addLayer({
    id: DISTRICT_SELECTED_GLOW_LAYER_ID,
    type: "line",
    source: DISTRICT_SOURCE_ID,
    filter: ["==", ["get", "selected"], true],
    paint: {
      "line-color": "rgba(255, 107, 0, 0.38)",
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
        6,
        13,
        10,
        16,
        14,
      ],
      "line-blur": 4,
    },
  });

  map.addLayer({
    id: DISTRICT_SELECTED_BORDER_LAYER_ID,
    type: "line",
    source: DISTRICT_SOURCE_ID,
    filter: ["==", ["get", "selected"], true],
    paint: {
      "line-color": "rgba(255, 107, 0, 0.98)",
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
        3.6,
        13,
        5.4,
        16,
        7,
      ],
      "line-blur": 0.25,
    },
  });
}

function fitMapToRequests(
  map: maplibregl.Map,
  requests: CivicRequest[],
  fitToData: boolean,
  padding: MapPadding,
) {
  if (!fitToData) {
    return;
  }

  if (requests.length === 0) {
    map.easeTo({ center: ASTANA_CENTER, zoom: 11.5, duration: 400 });
    return;
  }

  if (requests.length === 1) {
    map.easeTo({
      center: [requests[0].point.lng || ASTANA_CENTER[0], requests[0].point.lat || ASTANA_CENTER[1]],
      zoom: 14,
      duration: 400,
    });
    return;
  }

  const bounds = requests.reduce(
    (accumulator, request) =>
      accumulator.extend([
        request.point.lng || ASTANA_CENTER[0],
        request.point.lat || ASTANA_CENTER[1],
      ]),
    new maplibregl.LngLatBounds(
      [requests[0].point.lng || ASTANA_CENTER[0], requests[0].point.lat || ASTANA_CENTER[1]],
      [requests[0].point.lng || ASTANA_CENTER[0], requests[0].point.lat || ASTANA_CENTER[1]],
    ),
  );

  map.fitBounds(bounds, {
    padding,
    duration: 450,
    maxZoom: 15,
  });
}

function fitMapToDistrict(
  map: maplibregl.Map,
  selectedDistrictId: string,
  fitToData: boolean,
  padding: MapPadding,
) {
  if (!fitToData || selectedDistrictId === CITY_DISTRICT_ID) {
    return false;
  }

  const districtBounds = getDistrictBounds(selectedDistrictId);

  if (!districtBounds) {
    return false;
  }

  map.fitBounds(new maplibregl.LngLatBounds(districtBounds[0], districtBounds[1]), {
    padding,
    duration: 480,
    maxZoom: 13.8,
  });

  return true;
}

export function useMapLibreRequestMap({
  requests,
  districtRequests,
  currentUserId,
  mode,
  layers = defaultLayers,
  selectedDistrictId = CITY_DISTRICT_ID,
  selectedRequestId,
  onSelectRequest,
  onSelectDistrict,
  palette,
  mineRadius,
  defaultRadius,
  clustered = false,
  fitToData = true,
  fitPadding = defaultFitPadding,
}: UseMapLibreRequestMapOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const districtPopupRef = useRef<maplibregl.Popup | null>(null);
  const activeLayers = useMemo(
    () => ({
      ...layers,
      clusters: clustered && layers.clusters,
    }),
    [clustered, layers],
  );
  const filteredRequests = useMemo(
    () => getFilteredRequests(requests, currentUserId, mode),
    [requests, currentUserId, mode],
  );
  const filteredRequestsRef = useRef(filteredRequests);
  const layersRef = useRef(activeLayers);
  const featureCollection = useMemo(
    () =>
      buildRequestFeatureCollection(
        filteredRequests,
        currentUserId,
        palette,
        mineRadius,
        defaultRadius,
        selectedRequestId,
      ) as GeoJSON.FeatureCollection,
    [currentUserId, defaultRadius, filteredRequests, mineRadius, palette, selectedRequestId],
  );
  const districtFeatureCollection = useMemo(
    () =>
      buildDistrictFeatureCollection(
        districtRequests ?? requests,
        selectedDistrictId,
      ) as GeoJSON.FeatureCollection,
    [districtRequests, requests, selectedDistrictId],
  );
  const selectedRequest = filteredRequests.find((request) => request.id === selectedRequestId);
  const featureCollectionRef = useRef(featureCollection);
  const districtFeatureCollectionRef = useRef(districtFeatureCollection);
  const modeRef = useRef(mode);
  const selectedDistrictIdRef = useRef(selectedDistrictId);
  const fitToDataRef = useRef(fitToData);
  const fitPaddingRef = useRef(fitPadding);
  const handleSelectRequest = useEffectEvent((request: CivicRequest) => onSelectRequest?.(request));
  const handleSelectDistrict = useEffectEvent((districtId: string) => onSelectDistrict?.(districtId));

  useEffect(() => {
    filteredRequestsRef.current = filteredRequests;
    layersRef.current = activeLayers;
    featureCollectionRef.current = featureCollection;
    districtFeatureCollectionRef.current = districtFeatureCollection;
    modeRef.current = mode;
    selectedDistrictIdRef.current = selectedDistrictId;
    fitToDataRef.current = fitToData;
    fitPaddingRef.current = fitPadding;
  }, [
    activeLayers,
    districtFeatureCollection,
    featureCollection,
    filteredRequests,
    fitPadding,
    fitToData,
    mode,
    selectedDistrictId,
  ]);

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
      const requestLayers = getRequestInteractiveLayerIds(map, layersRef.current);
      const requestFeatures = requestLayers.length > 0
        ? map.queryRenderedFeatures(event.point, { layers: requestLayers })
        : [];
      const requestFeature = requestFeatures[0];

      if (requestFeature) {
        if (requestFeature.layer.id === CLUSTER_LAYER_ID) {
          const clusterId = requestFeature.properties?.cluster_id;
          const geometry = requestFeature.geometry;
          const clusterSource = map.getSource(CLUSTER_SOURCE_ID) as GeoJSONSource | undefined;

          if (clusterSource && typeof clusterId !== "undefined" && geometry.type === "Point") {
            void clusterSource.getClusterExpansionZoom(Number(clusterId)).then((zoom) => {
              map.easeTo({
                center: geometry.coordinates as [number, number],
                zoom,
                duration: 350,
              });
            });
          }

          return;
        }

        const requestId = String(requestFeature.properties?.requestId ?? "");
        const request = filteredRequestsRef.current.find((item) => item.id === requestId);

        if (request) {
          handleSelectRequest(request);
        }

        return;
      }

      if (layersRef.current.districts && map.getLayer(DISTRICT_FILL_LAYER_ID)) {
        const districtFeature = map.queryRenderedFeatures(event.point, {
          layers: [DISTRICT_FILL_LAYER_ID],
        })[0];
        const districtId = String(districtFeature?.properties?.districtId ?? "");

        if (districtId) {
          handleSelectDistrict(districtId);
        }
      }
    };

    const handleMove = (event: maplibregl.MapMouseEvent) => {
      const canvas = map.getCanvas();
      const requestLayers = getRequestInteractiveLayerIds(map, layersRef.current);
      const requestFeatures = requestLayers.length > 0
        ? map.queryRenderedFeatures(event.point, { layers: requestLayers })
        : [];
      const districtFeatures =
        layersRef.current.districts && map.getLayer(DISTRICT_FILL_LAYER_ID)
          ? map.queryRenderedFeatures(event.point, { layers: [DISTRICT_FILL_LAYER_ID] })
          : [];

      canvas.style.cursor = requestFeatures.length > 0 || districtFeatures.length > 0 ? "pointer" : "";

      const districtFeature = districtFeatures[0];
      const districtId = String(districtFeature?.properties?.districtId ?? "");
      const districtName = String(districtFeature?.properties?.name ?? "");

      if (districtId && map.getLayer(DISTRICT_HOVER_LAYER_ID)) {
        map.setFilter(DISTRICT_HOVER_LAYER_ID, ["==", ["get", "districtId"], districtId]);

        if (!districtPopupRef.current) {
          districtPopupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: "district-map-tooltip",
            offset: 12,
          });
        }

        districtPopupRef.current
          .setLngLat(event.lngLat)
          .setText(districtName)
          .addTo(map);
      } else {
        if (map.getLayer(DISTRICT_HOVER_LAYER_ID)) {
          map.setFilter(DISTRICT_HOVER_LAYER_ID, ["==", ["get", "districtId"], ""]);
        }

        districtPopupRef.current?.remove();
      }
    };

    map.on("load", () => {
      addMapLayers(map);
      setSourceData(map, RAW_SOURCE_ID, featureCollectionRef.current);
      setSourceData(map, CLUSTER_SOURCE_ID, featureCollectionRef.current);
      setSourceData(map, DISTRICT_SOURCE_ID, districtFeatureCollectionRef.current);
      syncMapLayerVisibility(map, modeRef.current, layersRef.current);

      if (
        !fitMapToDistrict(
          map,
          selectedDistrictIdRef.current,
          fitToDataRef.current,
          fitPaddingRef.current,
        )
      ) {
        fitMapToRequests(
          map,
          filteredRequestsRef.current,
          fitToDataRef.current,
          fitPaddingRef.current,
        );
      }
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
      districtPopupRef.current?.remove();
      districtPopupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !map.isStyleLoaded()) {
      return;
    }

    setSourceData(map, RAW_SOURCE_ID, featureCollection);
    setSourceData(map, CLUSTER_SOURCE_ID, featureCollection);
    setSourceData(map, DISTRICT_SOURCE_ID, districtFeatureCollection);
    syncMapLayerVisibility(map, mode, activeLayers);

    if (!fitMapToDistrict(map, selectedDistrictId, fitToData, fitPadding)) {
      fitMapToRequests(map, filteredRequests, fitToData, fitPadding);
    }
  }, [
    districtFeatureCollection,
    featureCollection,
    filteredRequests,
    fitPadding,
    fitToData,
    activeLayers,
    mode,
    selectedDistrictId,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !selectedRequest) {
      return;
    }

    map.easeTo({
      center: [selectedRequest.point.lng || ASTANA_CENTER[0], selectedRequest.point.lat || ASTANA_CENTER[1]],
      zoom: Math.max(map.getZoom(), 14.3),
      duration: 360,
    });
  }, [selectedRequest]);

  const zoomIn = () => {
    mapRef.current?.zoomIn({ duration: 220 });
  };

  const zoomOut = () => {
    mapRef.current?.zoomOut({ duration: 220 });
  };

  return {
    containerRef,
    zoomIn,
    zoomOut,
  };
}

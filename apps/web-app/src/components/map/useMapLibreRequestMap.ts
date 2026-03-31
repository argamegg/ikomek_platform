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

type UseMapLibreRequestMapOptions = {
  requests: CivicRequest[];
  currentUserId?: string;
  mode: MapMode;
  onSelectRequest?: (request: CivicRequest) => void;
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

  if (clustered) {
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
        "circle-stroke-color": "rgba(255,255,255,0.92)",
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
        "circle-stroke-color": "#ffffff",
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
    padding: 36,
    duration: 450,
    maxZoom: 15,
  });
}

export function useMapLibreRequestMap({
  requests,
  currentUserId,
  mode,
  onSelectRequest,
  palette,
  mineRadius,
  defaultRadius,
  clustered = false,
  fitToData = true,
}: UseMapLibreRequestMapOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
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
      const features = map.queryRenderedFeatures(event.point, {
        layers: clustered
          ? [CLUSTER_LAYER_ID, UNCLUSTERED_LAYER_ID]
          : [POINT_LAYER_ID],
      });
      const feature = features[0];

      if (!feature) {
        return;
      }

      if (clustered && feature.layer.id === CLUSTER_LAYER_ID) {
        const clusterId = feature.properties?.cluster_id;
        const geometry = feature.geometry;
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

      const requestId = String(feature.properties?.requestId ?? "");
      const request = filteredRequestsRef.current.find((item) => item.id === requestId);

      if (request) {
        handleSelectRequest(request);
      }
    };

    const handleMove = (event: maplibregl.MapMouseEvent) => {
      const canvas = map.getCanvas();
      const features = map.queryRenderedFeatures(event.point, {
        layers: clustered
          ? [CLUSTER_LAYER_ID, UNCLUSTERED_LAYER_ID]
          : [POINT_LAYER_ID],
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
    fitMapToRequests(map, filteredRequests, fitToData);
  }, [clustered, featureCollection, filteredRequests, fitToData, mode]);

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

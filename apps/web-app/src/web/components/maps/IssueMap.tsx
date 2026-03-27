import { useEffect, useEffectEvent, useRef } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import HeatmapLayer from "ol/layer/Heatmap";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import Cluster from "ol/source/Cluster";
import { fromLonLat } from "ol/proj";
import { isEmpty as isEmptyExtent } from "ol/extent";
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from "ol/style";
import type { CivicRequest, MapMode } from "../../../types/platform";

const ASTANA_CENTER = fromLonLat([71.4304, 51.1282]);

type IssueMapProps = {
  requests: CivicRequest[];
  currentUserId?: string;
  mode: MapMode;
  onSelectRequest?: (request: CivicRequest) => void;
};

function markerStyle(size: number, color: string, text?: string) {
  return new Style({
    image: new CircleStyle({
      radius: size,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: "rgba(255,255,255,0.92)", width: 3 }),
    }),
    text: text
      ? new Text({
          text,
          fill: new Fill({ color: "#fff" }),
          font: "600 12px Inter, sans-serif",
        })
      : undefined,
  });
}

function buildFeature(request: CivicRequest, currentUserId?: string) {
  const feature = new Feature({
    geometry: new Point(fromLonLat([request.point.lng || 71.4304, request.point.lat || 51.1282])),
    weight: request.priority === "critical" || request.priority === "high" ? 1 : 0.6,
  });

  feature.set("request", request);
  feature.set(
    "tone",
    request.citizenId === currentUserId
      ? "rgba(255, 107, 0, 0.92)"
      : request.priority === "critical"
        ? "rgba(225, 29, 72, 0.9)"
        : "rgba(15, 23, 42, 0.75)",
  );
  return feature;
}

export function IssueMap({ requests, currentUserId, mode, onSelectRequest }: IssueMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const clusterSourceRef = useRef<Cluster | null>(null);
  const clusterLayerRef = useRef<VectorLayer<Cluster> | null>(null);
  const heatLayerRef = useRef<HeatmapLayer | null>(null);
  const viewRef = useRef<View | null>(null);
  const handleSelectRequest = useEffectEvent((request: CivicRequest) => onSelectRequest?.(request));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const vectorSource = new VectorSource();
    const clusterSource = new Cluster({
      distance: 38,
      source: vectorSource,
    });

    const clusterLayer = new VectorLayer({
      source: clusterSource,
      style(feature) {
        const features = feature.get("features") as Feature[] | undefined;
        const count = features?.length ?? 0;

        if (count > 1) {
          return markerStyle(Math.min(22, 12 + count), "rgba(255, 107, 0, 0.88)", String(count));
        }

        const tone = features?.[0]?.get("tone") as string | undefined;
        return markerStyle(10, tone ?? "rgba(15, 23, 42, 0.75)");
      },
    });

    const heatLayer = new HeatmapLayer({
      source: vectorSource,
      blur: 24,
      radius: 18,
      weight(feature) {
        return feature.get("weight") as number;
      },
    });

    const view = new View({
      center: ASTANA_CENTER,
      zoom: 11.5,
    });

    const map = new Map({
      target: containerRef.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        heatLayer,
        clusterLayer,
      ],
      view,
      controls: [],
    });

    map.on("singleclick", (event) => {
      map.forEachFeatureAtPixel(event.pixel, (feature) => {
        const features = feature.get("features") as Feature[] | undefined;
        const request = (features?.[0]?.get("request") as CivicRequest | undefined) ?? null;
        if (request) {
          handleSelectRequest(request);
        }
      });
    });

    mapRef.current = map;
    vectorSourceRef.current = vectorSource;
    clusterSourceRef.current = clusterSource;
    clusterLayerRef.current = clusterLayer;
    heatLayerRef.current = heatLayer;
    viewRef.current = view;

    const resizeObserver = new ResizeObserver(() => {
      map.updateSize();
    });
    resizeObserver.observe(containerRef.current);
    requestAnimationFrame(() => map.updateSize());
    setTimeout(() => map.updateSize(), 150);

    return () => {
      resizeObserver.disconnect();
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const vectorSource = vectorSourceRef.current;
    const heatLayer = heatLayerRef.current;
    const clusterLayer = clusterLayerRef.current;
    const view = viewRef.current;
    const map = mapRef.current;

    if (!vectorSource || !heatLayer || !clusterLayer || !view || !map) {
      return;
    }

    const filteredRequests =
      mode === "my" && currentUserId
        ? requests.filter((request) => request.citizenId === currentUserId)
        : requests;

    vectorSource.clear();
    filteredRequests.forEach((request) => vectorSource.addFeature(buildFeature(request, currentUserId)));
    heatLayer.setVisible(mode === "heatmap");
    clusterLayer.setVisible(mode !== "heatmap");
    map.updateSize();

    const extent = vectorSource.getExtent();
    if (extent && !isEmptyExtent(extent)) {
      view.fit(extent, {
        padding: [36, 36, 36, 36],
        duration: 220,
        maxZoom: 15,
      });
    } else {
      view.animate({ center: ASTANA_CENTER, zoom: 11.5, duration: 220 });
    }
  }, [requests, currentUserId, mode]);

  return (
    <div className="map-card">
      <div ref={containerRef} className="map-canvas" />
      <div className="map-controls">
        <button
          type="button"
          onClick={() => viewRef.current?.animate({ zoom: (viewRef.current.getZoom() ?? 11) + 1, duration: 220 })}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => viewRef.current?.animate({ zoom: (viewRef.current.getZoom() ?? 11) - 1, duration: 220 })}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import "ol/ol.css";
import Feature from "ol/Feature";
import Map from "ol/Map";
import View from "ol/View";
import Point from "ol/geom/Point";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import HeatmapLayer from "ol/layer/Heatmap";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";
import type { CivicRequest, MapMode } from "../../types/platform";

type OpenLayersMapProps = {
  requests: CivicRequest[];
  currentUserId?: string;
  mode: MapMode;
  onSelectRequest: (request: CivicRequest) => void;
};

function buildFeature(request: CivicRequest, currentUserId?: string) {
  const feature = new Feature({
    geometry: new Point(fromLonLat([request.point.lng, request.point.lat])),
    weight: request.priority === "critical" ? 1 : request.priority === "warning" ? 0.66 : 0.4,
  });
  feature.set("requestId", request.id);
  feature.set("request", request);
  feature.setStyle(
    new Style({
      image: new CircleStyle({
        radius: request.citizenId === currentUserId ? 8 : 6,
        fill: new Fill({
          color:
            request.citizenId === currentUserId
              ? "#17314a"
              : request.priority === "critical"
                ? "#db5a43"
                : "#f47b20",
        }),
        stroke: new Stroke({
          color: "#ffffff",
          width: 2,
        }),
      }),
    }),
  );
  return feature;
}

export function OpenLayersMap({
  requests,
  currentUserId,
  mode,
  onSelectRequest,
}: OpenLayersMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const filteredRequests =
      mode === "my" && currentUserId
        ? requests.filter((request) => request.citizenId === currentUserId)
        : requests;

    const vectorSource = new VectorSource({
      features: filteredRequests.map((request) => buildFeature(request, currentUserId)),
    });

    const markerLayer = new VectorLayer({
      source: vectorSource,
      visible: mode !== "heatmap",
    });

    const heatLayer = new HeatmapLayer({
      source: vectorSource,
      blur: 22,
      radius: 16,
      visible: mode === "heatmap",
    });

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        heatLayer,
        markerLayer,
      ],
      view: new View({
        center: fromLonLat([71.4304, 51.1282]),
        zoom: 11.5,
      }),
    });

    map.on("singleclick", (event) => {
      map.forEachFeatureAtPixel(event.pixel, (feature) => {
        const request = feature.get("request") as CivicRequest | undefined;

        if (request) {
          onSelectRequest(request);
        }
      });
    });
    console.log("Map initialized");

    mapInstanceRef.current = map;

    return () => {
      map.setTarget(undefined);
      mapInstanceRef.current = null;
    };
  }, [requests, currentUserId, mode, onSelectRequest]);

  return <div ref={mapRef} className="ol-map" />;
}

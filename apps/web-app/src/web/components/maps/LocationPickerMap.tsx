import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { useTranslation } from "react-i18next";
import "maplibre-gl/dist/maplibre-gl.css";
import { REQUEST_MAP_STYLE } from "../../../components/map/requestMapConfig";
import { ASTANA_CENTER_LNG, ASTANA_CENTER_LAT } from "../../lib/geoFence";

type LocationCoordinate = {
  lat: number;
  lng: number;
};

type LocationPickerMapProps = {
  coordinate: LocationCoordinate | null;
  onCoordinateChange: (coordinate: LocationCoordinate) => void;
};

const DEFAULT_CENTER: [number, number] = [ASTANA_CENTER_LNG, ASTANA_CENTER_LAT];

export function LocationPickerMap({ coordinate, onCoordinateChange }: LocationPickerMapProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const coordinateRef = useRef<LocationCoordinate | null>(coordinate);
  const onCoordinateChangeRef = useRef(onCoordinateChange);

  useEffect(() => {
    coordinateRef.current = coordinate;
  }, [coordinate]);

  useEffect(() => {
    onCoordinateChangeRef.current = onCoordinateChange;
  }, [onCoordinateChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: REQUEST_MAP_STYLE,
      center: coordinateRef.current
        ? [coordinateRef.current.lng, coordinateRef.current.lat]
        : DEFAULT_CENTER,
      zoom: coordinateRef.current ? 15.5 : 11.8,
      attributionControl: false,
      dragRotate: false,
      touchPitch: false,
      doubleClickZoom: true,
    });

    mapRef.current = map;

    const marker = new maplibregl.Marker({
      color: "#ff6b00",
      draggable: true,
    });
    markerRef.current = marker;
    if (coordinateRef.current) {
      marker.setLngLat([coordinateRef.current.lng, coordinateRef.current.lat]).addTo(map);
    }

    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      onCoordinateChangeRef.current({
        lat: event.lngLat.lat,
        lng: event.lngLat.lng,
      });
    };

    const handleMarkerDragEnd = () => {
      const lngLat = marker.getLngLat();
      onCoordinateChangeRef.current({
        lat: lngLat.lat,
        lng: lngLat.lng,
      });
    };

    map.on("click", handleMapClick);
    marker.on("dragend", handleMarkerDragEnd);

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(containerRef.current);

    requestAnimationFrame(() => map.resize());

    return () => {
      resizeObserver.disconnect();
      marker.remove();
      map.off("click", handleMapClick);
      marker.off("dragend", handleMarkerDragEnd);
      map.remove();
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;

    if (!map || !marker) {
      return;
    }

    if (!coordinate) {
      marker.remove();
      map.easeTo({ center: DEFAULT_CENTER, zoom: 11.8, duration: 350 });
      return;
    }

    marker.setLngLat([coordinate.lng, coordinate.lat]).addTo(map);
    map.easeTo({
      center: [coordinate.lng, coordinate.lat],
      zoom: Math.max(map.getZoom(), 15.5),
      duration: 350,
    });
  }, [coordinate]);

  const zoomIn = () => {
    mapRef.current?.zoomIn({ duration: 200 });
  };

  const zoomOut = () => {
    mapRef.current?.zoomOut({ duration: 200 });
  };

  return (
    <div className="map-card request-flow-location-map">
      <div ref={containerRef} className="map-canvas request-flow-location-map__canvas" />
      <div className="map-controls">
        <button
          type="button"
          onClick={zoomIn}
          aria-label={t("common.zoomIn")}
        >
          +
        </button>
        <button
          type="button"
          onClick={zoomOut}
          aria-label={t("common.zoomOut")}
        >
          −
        </button>
      </div>
    </div>
  );
}

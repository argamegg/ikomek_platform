import React, { useEffect, useMemo, useRef } from 'react';
import type { MapPoint } from '../utils/api';

type RequestsMapProps = {
  points: MapPoint[];
  categoryColors: Record<string, string>;
  statusColors: Record<string, string>;
  onPointPress: (point: MapPoint) => void;
  focusPoints?: MapPoint[] | null;
};

function generateMapHTML(
  points: MapPoint[],
  statusColors: Record<string, string>,
  focusPoints?: MapPoint[] | null,
) {
  const pointsJSON = JSON.stringify(points);
  const focusPointsJSON = JSON.stringify(focusPoints ?? []);

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>*{margin:0;padding:0}html,body,#map{width:100%;height:100%}</style>
</head><body>
<div id="map"></div>
<script>
	var STATUS_COLORS = ${JSON.stringify(statusColors)};
	var PUBLIC_MARKER_STROKE = 'rgba(255,255,255,0.92)';
	var MY_MARKER_STROKE = 'rgba(15,23,42,0.92)';
	var points = ${pointsJSON};
	var focusPoints = ${focusPointsJSON};
var map = L.map('map',{zoomControl:false}).setView([51.1282,71.4306],12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM',maxZoom:19}).addTo(map);
L.control.zoom({position:'topright'}).addTo(map);
points.forEach(function(p){
  var statusColor = STATUS_COLORS[p.status] || '#334155';
  var strokeColor = p.is_mine ? MY_MARKER_STROKE : PUBLIC_MARKER_STROKE;
  var marker = L.circleMarker([p.lat,p.lng],{
    radius:8.5, fillColor:statusColor, color:strokeColor, weight:3, fillOpacity:0.92, opacity:1
  }).addTo(map);
  marker.bindPopup('<div style="font-family:sans-serif"><b>'+p.title+'</b><br><span style="color:#666">'+p.address+'</span></div>');
  marker.on('click',function(){
    map.flyTo([p.lat,p.lng], Math.max(map.getZoom(), 15), { duration: 0.55 });
    try { window.parent.postMessage(JSON.stringify({type:'markerClick',point:p}),'*'); } catch(e){}
  });
});
function fitPointList(list) {
  if (!list || !list.length) return;
  if (list.length === 1) {
    map.flyTo([list[0].lat, list[0].lng], 15, { duration: 0.65 });
    return;
  }
  var bounds = L.latLngBounds(list.map(function(p){ return [p.lat, p.lng]; }));
  if (bounds.isValid()) map.flyToBounds(bounds, { padding: [48, 48], maxZoom: 15, duration: 0.65 });
}
fitPointList(focusPoints.length ? focusPoints : points);
<\/script>
</body></html>`;
}

export function RequestsMap({
  points,
  categoryColors: _categoryColors,
  statusColors,
  onPointPress,
  focusPoints,
}: RequestsMapProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'markerClick') {
          onPointPress(data.point);
        }
      } catch {}
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onPointPress]);

  const html = useMemo(
    () => generateMapHTML(points, statusColors, focusPoints),
    [focusPoints, points, statusColors],
  );

  const blobUrl = useMemo(() => {
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [html]);

  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  return (
    <iframe
      ref={iframeRef}
      src={blobUrl}
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  );
}

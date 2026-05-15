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
  categoryColors: Record<string, string>,
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
var CATEGORY_COLORS = ${JSON.stringify(categoryColors)};
var STATUS_COLORS = ${JSON.stringify(statusColors)};
var points = ${pointsJSON};
var focusPoints = ${focusPointsJSON};
var map = L.map('map',{zoomControl:false}).setView([51.1282,71.4306],12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM',maxZoom:19}).addTo(map);
L.control.zoom({position:'topright'}).addTo(map);
points.forEach(function(p){
  var color = STATUS_COLORS[p.status] || '#FF9500';
  var catColor = CATEGORY_COLORS[p.category] || '#9E9E9E';
  var marker = L.circleMarker([p.lat,p.lng],{
    radius:8, fillColor:catColor, color:color, weight:3, fillOpacity:0.85, opacity:1
  }).addTo(map);
  marker.bindPopup('<div style="font-family:sans-serif"><b>'+p.title+'</b><br><span style="color:#666">'+p.address+'</span></div>');
  marker.on('click',function(){
    try { window.parent.postMessage(JSON.stringify({type:'markerClick',point:p}),'*'); } catch(e){}
  });
});
function fitPointList(list) {
  if (!list || !list.length) return;
  if (list.length === 1) {
    map.setView([list[0].lat, list[0].lng], 15);
    return;
  }
  var bounds = L.latLngBounds(list.map(function(p){ return [p.lat, p.lng]; }));
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
}
fitPointList(focusPoints.length ? focusPoints : points);
<\/script>
</body></html>`;
}

export function RequestsMap({
  points,
  categoryColors,
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
    () => generateMapHTML(points, categoryColors, statusColors, focusPoints),
    [categoryColors, focusPoints, points, statusColors],
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

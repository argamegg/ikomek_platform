import React, { useEffect, useMemo, useRef } from 'react';
import type { MapPoint } from '../utils/api';

type RequestsMapProps = {
  points: MapPoint[];
  categoryColors: Record<string, string>;
  statusColors: Record<string, string>;
  onPointPress: (point: MapPoint) => void;
  focusPoints?: MapPoint[] | null;
  renderMode?: 'markers' | 'heatmap';
  heatmapColorMode?: 'density' | 'priority';
};

function generateMapHTML(
  points: MapPoint[],
  statusColors: Record<string, string>,
  focusPoints?: MapPoint[] | null,
  renderMode: 'markers' | 'heatmap' = 'markers',
  heatmapColorMode: 'density' | 'priority' = 'priority',
) {
  const pointsJSON = JSON.stringify(points);
  const focusPointsJSON = JSON.stringify(focusPoints ?? []);

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
*{margin:0;padding:0}
html,body,#map{width:100%;height:100%}
.heat-blob{
  width:var(--size);
  height:var(--size);
  border-radius:999px;
  background:radial-gradient(circle,rgba(var(--core),.52) 0%,rgba(var(--core),.34) 24%,rgba(var(--mid),.22) 48%,rgba(var(--edge),.16) 72%,rgba(var(--edge),0) 100%);
  filter:blur(10px) saturate(1.08);
  opacity:var(--opacity);
  pointer-events:none;
  transform:translate(-50%,-50%);
}
</style>
</head><body>
<div id="map"></div>
<script>
	var STATUS_COLORS = ${JSON.stringify(statusColors)};
	var PUBLIC_MARKER_STROKE = 'rgba(255,255,255,0.92)';
	var MY_MARKER_STROKE = 'rgba(15,23,42,0.92)';
	var renderMode = ${JSON.stringify(renderMode)};
	var heatmapColorMode = ${JSON.stringify(heatmapColorMode)};
	var points = ${pointsJSON};
	var focusPoints = ${focusPointsJSON};
var map = L.map('map',{zoomControl:false}).setView([51.1282,71.4306],12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM',maxZoom:19}).addTo(map);
L.control.zoom({position:'topright'}).addTo(map);

function getPriorityWeight(p) {
  if (p.priority === 'high') return 1;
  if (p.priority === 'medium') return 0.85;
  if (p.priority === 'low') return 0.72;
  return 0.68;
}
function distanceMeters(a,b) {
  var latMeters = (a.lat - b.lat) * 111320;
  var lngMeters = (a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(latMeters * latMeters + lngMeters * lngMeters);
}
function densityLevels(list) {
  var radius = 1900;
  var scores = list.map(function(point) {
    return list.reduce(function(total, candidate) {
      if (candidate.id === point.id) return total;
      var distance = distanceMeters(point, candidate);
      if (distance > radius) return total;
      var closeness = 1 - distance / radius;
      return total + closeness * closeness;
    }, 0);
  });
  var max = Math.max.apply(null, scores.concat([0]));
  var levels = {};
  list.forEach(function(point, index) { levels[point.id] = max > 0 ? scores[index] / max : 0; });
  return levels;
}
function densityPalette(level) {
  if (level >= .82) return { core:'69, 10, 10', mid:'153, 27, 27', edge:'249, 115, 22' };
  if (level >= .58) return { core:'153, 27, 27', mid:'239, 68, 68', edge:'251, 146, 60' };
  if (level >= .34) return { core:'249, 115, 22', mid:'251, 146, 60', edge:'250, 204, 21' };
  if (level >= .12) return { core:'250, 204, 21', mid:'253, 224, 71', edge:'254, 240, 138' };
  return { core:'254, 240, 138', mid:'254, 249, 195', edge:'254, 252, 232' };
}
function priorityPalette(p) {
  var weight = getPriorityWeight(p);
  if (weight >= .98) return { core:'153, 27, 27', mid:'239, 68, 68', edge:'251, 146, 60', level:.78 };
  if (weight >= .82) return { core:'249, 115, 22', mid:'251, 146, 60', edge:'250, 204, 21', level:.58 };
  if (weight >= .72) return { core:'250, 204, 21', mid:'253, 224, 71', edge:'254, 240, 138', level:.34 };
  return { core:'254, 240, 138', mid:'254, 249, 195', edge:'254, 252, 232', level:.12 };
}
if (renderMode === 'heatmap') {
  var levels = heatmapColorMode === 'density' ? densityLevels(points) : {};
  points.forEach(function(p) {
    var level = heatmapColorMode === 'density' ? levels[p.id] || 0 : priorityPalette(p).level;
    var palette = heatmapColorMode === 'density' ? densityPalette(level) : priorityPalette(p);
    var size = heatmapColorMode === 'density' ? Math.round(112 + level * 52) : Math.round(78 + getPriorityWeight(p) * 74);
    var opacity = heatmapColorMode === 'density' ? 0.42 + level * 0.24 : 0.5 + getPriorityWeight(p) * 0.16;
    var html = '<div class="heat-blob" style="--size:'+size+'px;--opacity:'+opacity+';--core:'+palette.core+';--mid:'+palette.mid+';--edge:'+palette.edge+'"></div>';
    L.marker([p.lat,p.lng], { icon: L.divIcon({ className:'', html:html, iconSize:[0,0], iconAnchor:[0,0] }), interactive:false }).addTo(map);
  });
} else {
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
}
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
  renderMode = 'markers',
  heatmapColorMode = 'priority',
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
    () => generateMapHTML(points, statusColors, focusPoints, renderMode, heatmapColorMode),
    [focusPoints, heatmapColorMode, points, renderMode, statusColors],
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

import type { CivicRequest, District, MapMode } from "../types/platform";
import { buildHeatmapPoints } from "./Heatmap";
import { getMarkerTone } from "./Markers";

export function buildRequestLayers(
  requests: CivicRequest[],
  currentUserId: string | undefined,
  mode: MapMode,
) {
  return requests
    .filter((request) => (mode === "my" ? request.citizenId === currentUserId : true))
    .map((request, index) => ({
      id: request.id,
      tone: getMarkerTone(request, currentUserId),
      x: `${14 + ((request.point.lng + index * 0.012) % 1) * 74}%`,
      y: `${12 + ((request.point.lat + index * 0.017) % 1) * 70}%`,
      title: request.title,
    }));
}

export function buildDistrictOverlays(districts: District[]) {
  return districts.map((district, index) => ({
    id: district.id,
    label: district.name,
    x: 12 + index * 18,
    y: 16 + index * 11,
  }));
}

export function buildHeatLayer(requests: CivicRequest[]) {
  return buildHeatmapPoints(requests);
}

import type { CivicRequest, District, MapMode } from "../types/platform";
import { buildDistrictOverlays, buildHeatLayer, buildRequestLayers } from "./Layers";

export function createMapEngine(
  requests: CivicRequest[],
  districts: District[],
  currentUserId: string | undefined,
  mode: MapMode,
) {
  return {
    city: "Astana",
    markers: buildRequestLayers(requests, currentUserId, mode),
    districts: buildDistrictOverlays(districts),
    heatmap: buildHeatLayer(requests),
  };
}

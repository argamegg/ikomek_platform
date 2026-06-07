import type { StyleSpecification } from "maplibre-gl";
import type { CivicRequest, MapMode } from "../../types/platform";

export const ASTANA_CENTER: [number, number] = [71.4304, 51.1282];

export const REQUEST_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "\u00A9 OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

export type RequestMapPalette = {
  mine: string;
  public: string;
  critical: string;
  default: string;
};

const STATUS_COLORS: Partial<Record<CivicRequest["status"], string>> = {
  pending: "rgba(255, 149, 0, 0.92)",
  in_progress: "rgba(0, 122, 255, 0.88)",
  closed: "rgba(52, 199, 89, 0.88)",
};

export function getFilteredRequests(
  requests: CivicRequest[],
  currentUserId: string | undefined,
  mode: MapMode,
) {
  return mode === "my" && currentUserId
    ? requests.filter((request) => request.citizenId === currentUserId)
    : requests;
}

export function getRequestCoordinate(request: CivicRequest): [number, number] {
  return [request.point.lng || ASTANA_CENTER[0], request.point.lat || ASTANA_CENTER[1]];
}

export function getRequestWeight(request: CivicRequest) {
  return request.priority === "high"
    ? 1
    : request.priority === "medium"
      ? 0.66
      : request.priority === "low"
        ? 0.4
        : 0.24;
}

export function getRequestColor(
  request: CivicRequest,
  palette: RequestMapPalette,
) {
  const statusColor = STATUS_COLORS[request.status];
  if (statusColor) return statusColor;

  return request.priority === "high" ? palette.critical : palette.default;
}

export function getRequestStrokeColor(
  request: CivicRequest,
  currentUserId: string | undefined,
  palette: RequestMapPalette,
) {
  return currentUserId && request.citizenId === currentUserId
    ? palette.mine
    : palette.public;
}

export function buildRequestFeatureCollection(
  requests: CivicRequest[],
  currentUserId: string | undefined,
  palette: RequestMapPalette,
  mineRadius: number,
  defaultRadius: number,
) {
  return {
    type: "FeatureCollection",
    features: requests.map((request) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: getRequestCoordinate(request),
      },
      properties: {
        requestId: request.id,
        status: request.status,
        color: getRequestColor(request, palette),
        strokeColor: getRequestStrokeColor(request, currentUserId, palette),
        weight: getRequestWeight(request),
        radius: request.citizenId === currentUserId ? mineRadius : defaultRadius,
      },
    })),
  };
}

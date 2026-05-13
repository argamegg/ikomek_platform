import type { StyleSpecification } from "maplibre-gl";
import type { CivicRequest, MapMode } from "../../types/platform";
import { isOverdueRequest } from "../../web/lib/mapDashboard";

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
  critical: string;
  default: string;
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
  return request.priority === "critical" || request.priority === "high"
    ? 1
    : request.priority === "warning"
      ? 0.66
      : 0.4;
}

export function getRequestColor(
  request: CivicRequest,
  currentUserId: string | undefined,
  palette: RequestMapPalette,
) {
  if (isOverdueRequest(request) || request.priority === "critical") {
    return palette.critical;
  }

  if (request.status === "closed" || request.status === "resolved") {
    return "#10b981";
  }

  if (request.status === "in_progress") {
    return "#2563eb";
  }

  if (request.status === "pending" || request.status === "open") {
    return "#f59e0b";
  }

  return request.citizenId === currentUserId ? palette.mine : palette.default;
}

export function getRequestRadius(
  request: CivicRequest,
  currentUserId: string | undefined,
  mineRadius: number,
  defaultRadius: number,
) {
  if (request.priority === "critical") {
    return defaultRadius + 6;
  }

  if (request.priority === "high") {
    return defaultRadius + 3;
  }

  if (request.priority === "low" || request.priority === "information") {
    return Math.max(defaultRadius - 3, 6);
  }

  return request.citizenId === currentUserId ? Math.max(defaultRadius, mineRadius - 1) : defaultRadius;
}

export function buildRequestFeatureCollection(
  requests: CivicRequest[],
  currentUserId: string | undefined,
  palette: RequestMapPalette,
  mineRadius: number,
  defaultRadius: number,
  selectedRequestId?: string | null,
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
        priority: request.priority,
        color: getRequestColor(request, currentUserId, palette),
        weight: getRequestWeight(request),
        radius: getRequestRadius(request, currentUserId, mineRadius, defaultRadius),
        strokeColor: request.id === selectedRequestId
          ? "#0f172a"
          : request.citizenId === currentUserId
            ? palette.mine
            : "#ffffff",
        strokeWidth: request.id === selectedRequestId ? 4 : 2.75,
        selected: request.id === selectedRequestId,
        critical: request.priority === "critical",
      },
    })),
  };
}

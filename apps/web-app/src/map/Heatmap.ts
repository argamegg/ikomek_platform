import type { CivicRequest } from "../types/platform";

export function buildHeatmapPoints(requests: CivicRequest[]) {
  return requests.map((request, index) => ({
    id: request.id,
    x: `${12 + ((request.point.lng + index * 0.01) % 1) * 76}%`,
    y: `${10 + ((request.point.lat + index * 0.01) % 1) * 72}%`,
  }));
}

import type { CivicRequest } from "../types/platform";

export function getMarkerTone(request: CivicRequest, currentUserId?: string) {
  if (currentUserId && request.citizenId === currentUserId) {
    return "mine";
  }

  return request.priority === "critical" ? "heat" : "public";
}

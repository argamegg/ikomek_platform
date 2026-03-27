import type { MapMode } from "../types/platform";

export function getMapModes(): MapMode[] {
  return ["all", "my", "heatmap"];
}

export function getMapFilterChips() {
  return ["Road issues", "Water supply", "Lighting", "Pending", "In progress", "Last 7 days"];
}

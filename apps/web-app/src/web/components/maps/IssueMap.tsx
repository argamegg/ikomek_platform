import type { CivicRequest, MapMode } from "../../../types/platform";
import { useMapLibreRequestMap } from "../../../components/map/useMapLibreRequestMap";
import type { MapLayerState } from "../../lib/mapDashboard";

type IssueMapProps = {
  requests: CivicRequest[];
  districtRequests?: CivicRequest[];
  currentUserId?: string;
  mode: MapMode;
  layers?: MapLayerState;
  selectedDistrictId?: string;
  selectedRequestId?: string | null;
  onSelectRequest?: (request: CivicRequest) => void;
  onSelectDistrict?: (districtId: string) => void;
  fitPadding?: number | { top: number; right: number; bottom: number; left: number };
};

export function IssueMap({
  requests,
  districtRequests,
  currentUserId,
  mode,
  layers,
  selectedDistrictId,
  selectedRequestId,
  onSelectRequest,
  onSelectDistrict,
  fitPadding,
}: IssueMapProps) {
  const { containerRef, zoomIn, zoomOut } = useMapLibreRequestMap({
    requests,
    districtRequests,
    currentUserId,
    mode,
    layers,
    selectedDistrictId,
    selectedRequestId,
    onSelectRequest,
    onSelectDistrict,
    palette: {
      mine: "rgba(255, 107, 0, 0.92)",
      critical: "rgba(225, 29, 72, 0.9)",
      default: "rgba(15, 23, 42, 0.75)",
    },
    mineRadius: 10,
    defaultRadius: 10,
    clustered: true,
    fitToData: true,
    fitPadding,
  });

  return (
    <div className="map-card">
      <div ref={containerRef} className="map-canvas" />
      <div className="map-controls">
        <button
          type="button"
          onClick={zoomIn}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={zoomOut}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>
    </div>
  );
}

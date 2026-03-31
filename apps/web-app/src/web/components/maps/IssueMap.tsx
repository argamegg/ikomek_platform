import type { CivicRequest, MapMode } from "../../../types/platform";
import { useMapLibreRequestMap } from "../../../components/map/useMapLibreRequestMap";

type IssueMapProps = {
  requests: CivicRequest[];
  currentUserId?: string;
  mode: MapMode;
  onSelectRequest?: (request: CivicRequest) => void;
};

export function IssueMap({ requests, currentUserId, mode, onSelectRequest }: IssueMapProps) {
  const { containerRef, zoomIn, zoomOut } = useMapLibreRequestMap({
    requests,
    currentUserId,
    mode,
    onSelectRequest,
    palette: {
      mine: "rgba(255, 107, 0, 0.92)",
      critical: "rgba(225, 29, 72, 0.9)",
      default: "rgba(15, 23, 42, 0.75)",
    },
    mineRadius: 10,
    defaultRadius: 10,
    clustered: true,
    fitToData: true,
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

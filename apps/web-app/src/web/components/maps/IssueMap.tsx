import type { CivicRequest, MapMode } from "../../../types/platform";
import { useMapLibreRequestMap } from "../../../components/map/useMapLibreRequestMap";

type IssueMapProps = {
  requests: CivicRequest[];
  currentUserId?: string;
  mode: MapMode;
  onSelectRequest?: (request: CivicRequest) => void;
  focusRequestId?: string | null;
};

export function IssueMap({ requests, currentUserId, mode, onSelectRequest, focusRequestId }: IssueMapProps) {
  const { containerRef, zoomIn, zoomOut, locateUser } = useMapLibreRequestMap({
    requests,
    currentUserId,
    mode,
    onSelectRequest,
    focusRequestId,
    palette: {
      mine: "rgba(15, 23, 42, 0.92)",
      public: "rgba(255, 255, 255, 0.92)",
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
        <button
          type="button"
          onClick={locateUser}
          aria-label="Locate me"
        >
          ⌖
        </button>
      </div>
    </div>
  );
}

import type { CivicRequest, MapMode } from "../../types/platform";
import { useMapLibreRequestMap } from "./useMapLibreRequestMap";

type OpenLayersMapProps = {
  requests: CivicRequest[];
  currentUserId?: string;
  mode: MapMode;
  onSelectRequest: (request: CivicRequest) => void;
};

export function OpenLayersMap({
  requests,
  currentUserId,
  mode,
  onSelectRequest,
}: OpenLayersMapProps) {
  const { containerRef } = useMapLibreRequestMap({
    requests,
    currentUserId,
    mode,
    onSelectRequest,
    palette: {
      mine: "#17314a",
      public: "rgba(255, 255, 255, 0.92)",
      critical: "#db5a43",
      default: "#f47b20",
    },
    mineRadius: 8,
    defaultRadius: 8,
    clustered: false,
    fitToData: false,
  });

  return <div ref={containerRef} className="ol-map" />;
}

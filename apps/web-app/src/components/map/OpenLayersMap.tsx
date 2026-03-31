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
      critical: "#db5a43",
      default: "#f47b20",
    },
    mineRadius: 8,
    defaultRadius: 6,
    clustered: false,
    fitToData: false,
  });

  return <div ref={containerRef} className="ol-map" />;
}

import type { CivicRequest, MapMode } from "../../../types/platform";
import { useMapLibreRequestMap } from "../../../components/map/useMapLibreRequestMap";
import { useTranslation } from "react-i18next";
import type { HeatmapColorMode } from "../../../components/map/requestMapConfig";

type IssueMapProps = {
  requests: CivicRequest[];
  currentUserId?: string;
  mode: MapMode;
  onSelectRequest?: (request: CivicRequest) => void;
  focusRequestId?: string | null;
  heatmapColorMode?: HeatmapColorMode;
};

const ISSUE_MAP_PALETTE = {
  mine: "rgba(15, 23, 42, 0.92)",
  public: "rgba(255, 255, 255, 0.92)",
  critical: "rgba(225, 29, 72, 0.9)",
  default: "rgba(15, 23, 42, 0.75)",
};

export function IssueMap({
  requests,
  currentUserId,
  mode,
  onSelectRequest,
  focusRequestId,
  heatmapColorMode = "priority",
}: IssueMapProps) {
  const { t } = useTranslation();
  const { containerRef, zoomIn, zoomOut, locateUser } = useMapLibreRequestMap({
    requests,
    currentUserId,
    mode,
    onSelectRequest,
    focusRequestId,
    palette: ISSUE_MAP_PALETTE,
    mineRadius: 10,
    defaultRadius: 10,
    clustered: true,
    fitToData: true,
    heatmapColorMode,
  });

  return (
    <div className="map-card">
      <div ref={containerRef} className="map-canvas" />
      <div className="map-controls">
        <button
          type="button"
          onClick={zoomIn}
          aria-label={t("common.zoomIn")}
        >
          +
        </button>
        <button
          type="button"
          onClick={zoomOut}
          aria-label={t("common.zoomOut")}
        >
          −
        </button>
        <button
          type="button"
          onClick={locateUser}
          aria-label={t("common.locateMe")}
        >
          ⌖
        </button>
      </div>
    </div>
  );
}

import type { CivicRequest, MapMode } from "../../../types/platform";
import { IssueMap } from "./IssueMap";
import type { MapLayerState } from "../../lib/mapDashboard";

type CleanCityMapProps = {
  requests: CivicRequest[];
  districtRequests: CivicRequest[];
  currentUserId?: string;
  mode: MapMode;
  layers: MapLayerState;
  selectedDistrictId: string;
  selectedRequestId: string | null;
  onSelectRequest: (request: CivicRequest) => void;
  onSelectDistrict: (districtId: string) => void;
};

export function CleanCityMap({
  requests,
  districtRequests,
  currentUserId,
  mode,
  layers,
  selectedDistrictId,
  selectedRequestId,
  onSelectRequest,
  onSelectDistrict,
}: CleanCityMapProps) {
  return (
    <div className="clean-city-map__canvas">
      <IssueMap
        requests={requests}
        districtRequests={districtRequests}
        currentUserId={currentUserId}
        mode={mode}
        layers={layers}
        selectedDistrictId={selectedDistrictId}
        selectedRequestId={selectedRequestId}
        onSelectRequest={onSelectRequest}
        onSelectDistrict={onSelectDistrict}
        fitPadding={72}
      />
    </div>
  );
}

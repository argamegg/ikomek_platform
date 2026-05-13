import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { CivicRequest, Locale, MapMode } from "../../types/platform";
import { CITY_DISTRICT_ID } from "../../components/map/mapDistricts";
import { CleanCityMap } from "../components/maps/CleanCityMap";
import { DistrictAnalyticsPanel } from "../components/maps/DistrictAnalyticsPanel";
import { MapLayerControls } from "../components/maps/MapLayerControls";
import { Tabs } from "../components/ui/Tabs";
import {
  buildAnalyticsStats,
  buildDistrictStats,
  defaultMapLayers,
  getScopedRequests,
  getVisibleRequests,
  type MapLayerState,
} from "../lib/mapDashboard";
import { platformApi, queryKeys } from "../services/platformApi";

function resolveLocale(value: string): Locale {
  return value === "ru" || value === "kz" || value === "en" ? value : "ru";
}

export function MapPage() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<MapMode>("all");
  const [layers, setLayers] = useState<MapLayerState>(defaultMapLayers);
  const [selectedDistrictId, setSelectedDistrictId] = useState(CITY_DISTRICT_ID);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });
  const publicRequestsQuery = useQuery({
    queryKey: [...queryKeys.publicRequests, i18n.language],
    queryFn: platformApi.getPublicRequests,
  });
  const myRequestsQuery = useQuery({ queryKey: [...queryKeys.myRequests, i18n.language], queryFn: platformApi.getMyRequests });
  const districtsQuery = useQuery({ queryKey: queryKeys.districts, queryFn: platformApi.getDistricts });

  const allRequests = useMemo(() => {
    const map = new Map<string, CivicRequest>();

    for (const request of publicRequestsQuery.data ?? []) {
      map.set(request.id, request);
    }

    for (const request of myRequestsQuery.data ?? []) {
      map.set(request.id, request);
    }

    return Array.from(map.values());
  }, [myRequestsQuery.data, publicRequestsQuery.data]);

  const scopedRequests = useMemo(
    () => getScopedRequests(allRequests, currentUserQuery.data?.id, mode),
    [allRequests, currentUserQuery.data?.id, mode],
  );
  const visibleRequests = useMemo(
    () => getVisibleRequests(scopedRequests, selectedDistrictId),
    [scopedRequests, selectedDistrictId],
  );
  const districtStats = useMemo(
    () => buildDistrictStats(scopedRequests, districtsQuery.data ?? []),
    [districtsQuery.data, scopedRequests],
  );
  const analyticsStats = useMemo(
    () => buildAnalyticsStats(visibleRequests, selectedDistrictId, districtStats),
    [districtStats, selectedDistrictId, visibleRequests],
  );
  const selectedRequest = visibleRequests.find((request) => request.id === selectedId) ?? null;
  const activeSelectedId = selectedRequest?.id ?? null;
  const locale = resolveLocale(i18n.language);

  function handleModeChange(value: string) {
    setMode(value as MapMode);
  }

  function handleSelectDistrict(districtId: string) {
    setSelectedDistrictId(districtId);
    setSelectedId(null);
  }

  function handleSelectRequest(request: CivicRequest) {
    setSelectedId(request.id);
  }

  return (
    <div className="map-dashboard">
      <section className="map-dashboard__surface" aria-label={t("map.title")}>
        <CleanCityMap
          requests={visibleRequests}
          districtRequests={scopedRequests}
          currentUserId={currentUserQuery.data?.id}
          mode={mode}
          layers={layers}
          selectedDistrictId={selectedDistrictId}
          selectedRequestId={activeSelectedId}
          onSelectRequest={handleSelectRequest}
          onSelectDistrict={handleSelectDistrict}
        />

        <div className="map-dashboard__tools" aria-label="Фильтры и слои карты">
          <Tabs
            value={mode}
            onChange={handleModeChange}
            options={[
              { key: "all", label: t("map.all") },
              { key: "my", label: t("map.mine") },
            ]}
            className="map-dashboard__tabs"
          />
          <MapLayerControls layers={layers} onChange={setLayers} />
        </div>
      </section>

      <DistrictAnalyticsPanel
        selectedDistrictId={selectedDistrictId}
        cityTotal={scopedRequests.length}
        districts={districtStats}
        stats={analyticsStats}
        selectedRequest={selectedRequest}
        selectedRequestId={activeSelectedId}
        locale={locale}
        t={t}
        onSelectDistrict={handleSelectDistrict}
        onSelectRequest={handleSelectRequest}
      />
    </div>
  );
}

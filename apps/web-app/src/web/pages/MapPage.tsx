import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { CivicRequest, MapMode } from "../../types/platform";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { IssueMap } from "../components/maps/IssueMap";
import { getPriorityTone, getStatusTone } from "../lib/format";
import {
  localizeRequestDescription,
  localizeRequestPriority,
  localizeRequestProblemType,
  localizeRequestStatus,
} from "../lib/requestMeta";
import { platformApi, queryKeys } from "../services/platformApi";

export function MapPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<MapMode>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });
  const publicRequestsQuery = useQuery({
    queryKey: queryKeys.publicRequests,
    queryFn: platformApi.getPublicRequests,
  });
  const myRequestsQuery = useQuery({ queryKey: queryKeys.myRequests, queryFn: platformApi.getMyRequests });
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

  const selectedRequest =
    allRequests.find((request) => request.id === selectedId) ?? allRequests[0] ?? null;

  return (
    <div className="page-stack">
      <PageHeader title={t("map.title")} description={t("map.description")} />
      <Card className="toolbar-card" hover={false}>
        <Tabs
          value={mode}
          onChange={(value) => setMode(value as MapMode)}
          options={[
            { key: "all", label: t("map.all") },
            { key: "my", label: t("map.mine") },
            { key: "heatmap", label: t("map.heatmap") },
          ]}
        />
      </Card>
      <div className="dashboard-grid dashboard-grid--wide">
        <Card className="section-card section-card--map" hover={false}>
          <IssueMap
            requests={allRequests}
            currentUserId={currentUserQuery.data?.id}
            mode={mode}
            onSelectRequest={(request) => setSelectedId(request.id)}
          />
        </Card>
        <Card className="section-card">
          <div className="section-card__header">
            <div>
              <span className="section-card__eyebrow">Selection</span>
              <h3>{selectedRequest ? localizeRequestProblemType(selectedRequest.categoryId || selectedRequest.categoryName, selectedRequest.title, t) : "Choose a marker"}</h3>
            </div>
          </div>
          {selectedRequest ? (
            <>
              <Badge tone={getPriorityTone(selectedRequest.priority)}>{localizeRequestPriority(selectedRequest.priority, t)}</Badge>
              <p>{selectedRequest.address}</p>
              <p>{localizeRequestDescription(selectedRequest.description, selectedRequest.categoryId, selectedRequest.title, selectedRequest.reasonId || selectedRequest.reasonName, t)}</p>
              <Badge tone={getStatusTone(selectedRequest.status)}>
                {localizeRequestStatus(selectedRequest.statusLabel || selectedRequest.status, t)}
              </Badge>
            </>
          ) : null}
          <div className="district-list">
            {(districtsQuery.data ?? []).slice(0, 8).map((district) => (
              <div key={district.id} className="district-list__item">
                <strong>{district.name}</strong>
                <span>{district.requestDensity ?? 0} density</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

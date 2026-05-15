import { useState } from "react";
import type { Copy } from "../../App";
import { MapLegend } from "../../components/map/MapLegend";
import { OpenLayersMap } from "../../components/map/OpenLayersMap";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SectionHeading } from "../../components/ui/SectionHeading";
import type { CivicRequest, District, MapMode, User } from "../../types/platform";

type MapAnalyticsSectionProps = {
  copy: Copy;
  currentUser: User | null;
  publicRequests: CivicRequest[];
  districts: District[];
};

export function MapAnalyticsSection({
  copy,
  currentUser,
  publicRequests,
  districts,
}: MapAnalyticsSectionProps) {
  const [mode, setMode] = useState<MapMode>("all");
  const [selectedRequest, setSelectedRequest] = useState<CivicRequest | null>(publicRequests[0] ?? null);

  return (
    <section className="section">
      <SectionHeading
        kicker={copy.map.kicker}
        title={copy.map.title}
        description={copy.map.description}
      />
      <div className="badge-row section-controls">
        <Button label="All requests" variant="chip" isActive={mode === "all"} onClick={() => setMode("all")} />
        <Button label="My requests" variant="chip" isActive={mode === "my"} onClick={() => setMode("my")} />
        <Button label="Heatmap" variant="chip" isActive={mode === "heatmap"} onClick={() => setMode("heatmap")} />
      </div>
      <div className="cards-grid cards-grid--two">
        <Card className="map-preview">
          <OpenLayersMap
            requests={publicRequests}
            currentUserId={currentUser?.id}
            mode={mode}
            onSelectRequest={setSelectedRequest}
          />
          <MapLegend
            legend={[
              { label: copy.map.legend[0], tone: "mine" },
              { label: copy.map.legend[1], tone: "public" },
              { label: copy.map.legend[2], tone: "heat" },
            ]}
          />
        </Card>
        <Card>
          <h3>Analytics summary</h3>
          <ul className="feature-list">
            <li>Total public requests: {publicRequests.length}</li>
            <li>High priority issues: {publicRequests.filter((item) => item.priority === "high").length}</li>
            <li>Pending issues: {publicRequests.filter((item) => item.status === "pending").length}</li>
            <li>Astana districts in view: {districts.length}</li>
          </ul>
          {selectedRequest ? (
            <div className="map-selection">
              <strong>{selectedRequest.title}</strong>
              <p>{selectedRequest.address}</p>
              <p>{selectedRequest.description}</p>
            </div>
          ) : null}
        </Card>
      </div>
    </section>
  );
}

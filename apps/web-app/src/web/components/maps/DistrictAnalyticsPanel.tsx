import type { TFunction } from "i18next";
import type { CivicRequest, Locale } from "../../../types/platform";
import { CITY_DISTRICT_ID, getDistrictName } from "../../../components/map/mapDistricts";
import type { AnalyticsStats, DistrictCardStat } from "../../lib/mapDashboard";
import { CategoryStats } from "./CategoryStats";
import { ComplaintDetails } from "./ComplaintDetails";
import { DistrictCards } from "./DistrictCards";
import { DistrictStats } from "./DistrictStats";
import { RecentComplaints } from "./RecentComplaints";

type DistrictAnalyticsPanelProps = {
  selectedDistrictId: string;
  cityTotal: number;
  districts: DistrictCardStat[];
  stats: AnalyticsStats;
  selectedRequest: CivicRequest | null;
  selectedRequestId: string | null;
  locale: Locale;
  t: TFunction;
  onSelectDistrict: (districtId: string) => void;
  onSelectRequest: (request: CivicRequest) => void;
};

export function DistrictAnalyticsPanel({
  selectedDistrictId,
  cityTotal,
  districts,
  stats,
  selectedRequest,
  selectedRequestId,
  locale,
  t,
  onSelectDistrict,
  onSelectRequest,
}: DistrictAnalyticsPanelProps) {
  const title =
    selectedDistrictId === CITY_DISTRICT_ID
      ? "Вся Астана"
      : `${getDistrictName(selectedDistrictId)} район`;

  return (
    <aside className="analytics-bottom-panel" aria-label="Аналитика обращений">
      <DistrictCards
        selectedDistrictId={selectedDistrictId}
        cityTotal={cityTotal}
        districts={districts}
        onSelectDistrict={onSelectDistrict}
      />

      <div className="analytics-bottom-panel__body">
        <DistrictStats title={title} stats={stats} />
        <CategoryStats categories={stats.categories} />
        <RecentComplaints
          requests={stats.recent}
          selectedRequestId={selectedRequestId}
          locale={locale}
          t={t}
          onSelectRequest={onSelectRequest}
        />
        <div className="analytics-bottom-panel__side">
          <ComplaintDetails request={selectedRequest} locale={locale} t={t} />
          <section className="operator-recommendation">
            <div className="analytics-section-title">
              <span>Рекомендация</span>
            </div>
            <p>{stats.recommendation}</p>
            {stats.problemZones.length > 0 ? (
              <div className="operator-recommendation__zones">
                {stats.problemZones.map((zone) => (
                  <span key={zone}>{zone}</span>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </aside>
  );
}

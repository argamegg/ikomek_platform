import type { Copy } from "../../App";
import { Card } from "../../components/ui/Card";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { getCitizenRequestSummary } from "../../store/requestStore";
import type { CivicRequest, NewsItem, SavedLocation, User } from "../../types/platform";

type CitizenDashboardSectionProps = {
  copy: Copy;
  currentUser: User;
  requests: CivicRequest[];
  savedLocations: SavedLocation[];
  alerts: NewsItem[];
};

export function CitizenDashboardSection({
  copy,
  currentUser,
  requests,
  savedLocations,
  alerts,
}: CitizenDashboardSectionProps) {
  const summary = getCitizenRequestSummary(requests);

  return (
    <section className="section">
      <SectionHeading
        kicker={copy.citizenDashboard.kicker}
        title={`${copy.citizenDashboard.title} • ${currentUser.name}`}
        description={copy.citizenDashboard.description}
      />
      <div className="cards-grid cards-grid--three">
        <Card>
          <h3>Request health</h3>
          <strong className="section-metric">{summary.total}</strong>
          <p>{summary.active} active, {summary.pending} pending, {summary.closed} closed.</p>
        </Card>
        <Card>
          <h3>Saved addresses</h3>
          <ul className="feature-list">
            {savedLocations.slice(0, 4).map((item) => (
              <li key={item.id}>
                <strong>{item.label}</strong> • {item.address}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3>Latest alert</h3>
          <p>{alerts[0]?.title ?? "No active alerts."}</p>
          <p>{alerts[0]?.summary ?? "System will show the latest city notice here."}</p>
        </Card>
      </div>
    </section>
  );
}

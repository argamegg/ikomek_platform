import type { AnalyticsStats } from "../../lib/mapDashboard";

type DistrictStatsProps = {
  title: string;
  stats: AnalyticsStats;
};

export function DistrictStats({ title, stats }: DistrictStatsProps) {
  const items = [
    { label: "Всего", value: stats.total },
    { label: "Открыто", value: stats.open },
    { label: "В работе", value: stats.inProgress },
    { label: "Закрыто", value: stats.closed },
    { label: "Просрочено", value: stats.overdue },
  ];

  return (
    <section className="district-stats">
      <div className="analytics-section-title">
        <span>{title}</span>
        <strong>{stats.averagePriority}</strong>
      </div>
      <div className="district-stats__grid">
        {items.map((item) => (
          <div key={item.label} className="district-stats__metric">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      {stats.busiestDistrict ? (
        <div className="district-stats__highlight">
          <span>Самый загруженный район</span>
          <strong>{stats.busiestDistrict.name}</strong>
        </div>
      ) : null}
    </section>
  );
}

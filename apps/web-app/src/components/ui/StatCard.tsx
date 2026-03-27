import { formatMetric } from "../../utils/formatters";
import { Card } from "./Card";

type StatCardProps = {
  value: string | number;
  label: string;
  detail: string;
};

export function StatCard({ value, label, detail }: StatCardProps) {
  return (
    <Card className="stat-card">
      <strong>{typeof value === "number" ? formatMetric(value) : value}</strong>
      <span>{label}</span>
      <p>{detail}</p>
    </Card>
  );
}

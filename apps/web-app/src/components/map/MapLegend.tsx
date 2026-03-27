import { Card } from "../ui/Card";

type MapLegendProps = {
  legend: Array<{
    label: string;
    tone: "mine" | "public" | "heat";
  }>;
};

export function MapLegend({ legend }: MapLegendProps) {
  return (
    <Card className="map-legend">
      <p className="eyebrow">Map legend</p>
      <div className="map-legend__items">
        {legend.map((item) => (
          <div key={item.label} className="map-legend__item">
            <span className={`map-legend__dot map-legend__dot--${item.tone}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

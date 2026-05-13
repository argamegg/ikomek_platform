import { Flame, Layers3, MapPin, Orbit } from "lucide-react";
import type { MapLayerState } from "../../lib/mapDashboard";
import { cn } from "../../lib/cn";

type MapLayerControlsProps = {
  layers: MapLayerState;
  onChange: (layers: MapLayerState) => void;
};

const controls = [
  { key: "markers", label: "Маркеры", icon: MapPin },
  { key: "clusters", label: "Кластеры", icon: Orbit },
  { key: "heatmap", label: "Тепловая карта", icon: Flame },
  { key: "districts", label: "Районы", icon: Layers3 },
] satisfies Array<{ key: keyof MapLayerState; label: string; icon: typeof MapPin }>;

export function MapLayerControls({ layers, onChange }: MapLayerControlsProps) {
  return (
    <div className="map-layer-controls" aria-label="Слои карты">
      {controls.map((control) => {
        const Icon = control.icon;
        const active = layers[control.key];

        return (
          <button
            key={control.key}
            type="button"
            className={cn("map-layer-controls__item", active && "map-layer-controls__item--active")}
            onClick={() => onChange({ ...layers, [control.key]: !active })}
          >
            <Icon size={15} />
            <span>{control.label}</span>
          </button>
        );
      })}
    </div>
  );
}

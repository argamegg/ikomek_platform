import { CITY_DISTRICT_ID, getDistrictLoadLabel } from "../../../components/map/mapDistricts";
import type { DistrictCardStat } from "../../lib/mapDashboard";
import { cn } from "../../lib/cn";

type DistrictCardsProps = {
  selectedDistrictId: string;
  cityTotal: number;
  districts: DistrictCardStat[];
  onSelectDistrict: (districtId: string) => void;
};

export function DistrictCards({
  selectedDistrictId,
  cityTotal,
  districts,
  onSelectDistrict,
}: DistrictCardsProps) {
  return (
    <div className="district-filter-cards" aria-label="Фильтр районов">
      <button
        type="button"
        className={cn(
          "district-filter-card district-filter-card--city",
          selectedDistrictId === CITY_DISTRICT_ID && "district-filter-card--active",
        )}
        onClick={() => onSelectDistrict(CITY_DISTRICT_ID)}
      >
        <span className="district-filter-card__dot district-filter-card__dot--city" />
        <span>
          <strong>Вся Астана</strong>
          <small>{cityTotal} заявок</small>
        </span>
        <em>Сбросить фильтр</em>
      </button>

      {districts.map((district) => (
        <button
          key={district.id}
          type="button"
          className={cn(
            "district-filter-card",
            `district-filter-card--${district.loadLevel}`,
            selectedDistrictId === district.id && "district-filter-card--active",
          )}
          onClick={() => onSelectDistrict(district.id)}
        >
          <span className={cn("district-filter-card__dot", `district-filter-card__dot--${district.loadLevel}`)} />
          <span>
          <strong>{district.name}</strong>
          <small>{district.total} заявок</small>
          <small>{district.open} открыто · {district.closed} закрыто</small>
        </span>
          <em>{district.loadLabel || getDistrictLoadLabel(district.loadLevel)}</em>
        </button>
      ))}
    </div>
  );
}

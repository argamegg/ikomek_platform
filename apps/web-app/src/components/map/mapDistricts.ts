import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type { CivicRequest } from "../../types/platform";
import districtsGeoJsonRaw from "../../web/data/districts.geojson?raw";

export const CITY_DISTRICT_ID = "all";

export type DistrictLoadLevel = "low" | "medium" | "high" | "critical";

export type MapDistrictMeta = {
  id: string;
  name: string;
  aliases: string[];
  sourceStatus: "osm-relation" | "missing-official-geojson" | string;
  osmRelationId?: number | null;
  wikidata?: string | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  bounds: [[number, number], [number, number]] | null;
};

type DistrictProperties = {
  id?: string;
  name?: string;
  aliases?: string[];
  sourceStatus?: string;
  osmRelationId?: number | null;
  wikidata?: string | null;
};

type DistrictFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon | null, DistrictProperties>;

function normalizeDistrictValue(value?: string | null) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/қ/g, "к")
    .replace(/ң/g, "н")
    .replace(/ұ/g, "у")
    .replace(/ү/g, "у")
    .replace(/і/g, "и")
    .replace(/й/g, "и");
}

function walkCoordinates(value: unknown, visitor: (coordinate: [number, number]) => void) {
  if (!Array.isArray(value)) {
    return;
  }

  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    visitor([value[0], value[1]]);
    return;
  }

  for (const item of value) {
    walkCoordinates(item, visitor);
  }
}

function getGeometryBounds(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null) {
  if (!geometry) {
    return null;
  }

  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  walkCoordinates(geometry.coordinates, ([lng, lat]) => {
    west = Math.min(west, lng);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    north = Math.max(north, lat);
  });

  if (![west, south, east, north].every(Number.isFinite)) {
    return null;
  }

  return [[west, south], [east, north]] as [[number, number], [number, number]];
}

function normalizeFeature(feature: DistrictFeature): MapDistrictMeta | null {
  const id = feature.properties.id;
  const name = feature.properties.name;

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    aliases: feature.properties.aliases ?? [],
    sourceStatus: feature.properties.sourceStatus ?? "unknown",
    osmRelationId: feature.properties.osmRelationId,
    wikidata: feature.properties.wikidata,
    geometry: feature.geometry,
    bounds: getGeometryBounds(feature.geometry),
  };
}

const districtsGeoJson = JSON.parse(districtsGeoJsonRaw) as GeoJSON.FeatureCollection;
const districtFeatures = districtsGeoJson.features as DistrictFeature[];

export const ASTANA_MAP_DISTRICTS: MapDistrictMeta[] = districtFeatures
  .map(normalizeFeature)
  .filter((district): district is MapDistrictMeta => Boolean(district));

const normalizedDistricts = new Map(
  ASTANA_MAP_DISTRICTS.flatMap((district) => [
    [normalizeDistrictValue(district.id), district.id],
    [normalizeDistrictValue(district.name), district.id],
    ...district.aliases.map((alias) => [normalizeDistrictValue(alias), district.id] as const),
  ]),
);

export function resolveDistrictId(value?: string | null) {
  const normalized = normalizeDistrictValue(value);

  if (!normalized) {
    return null;
  }

  return normalizedDistricts.get(normalized) ?? null;
}

function getPointDistrictId(request: CivicRequest) {
  const requestPoint = point([request.point.lng, request.point.lat]);

  for (const district of ASTANA_MAP_DISTRICTS) {
    if (!district.geometry) {
      continue;
    }

    const polygonFeature = {
      type: "Feature",
      properties: {},
      geometry: district.geometry,
    } as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

    if (booleanPointInPolygon(requestPoint, polygonFeature)) {
      return district.id;
    }
  }

  return null;
}

export function getRequestDistrictId(request: CivicRequest) {
  const explicitDistrict = resolveDistrictId(request.districtId);

  if (explicitDistrict) {
    return explicitDistrict;
  }

  const addressDistrict = ASTANA_MAP_DISTRICTS.find((district) => {
    const normalizedAddress = normalizeDistrictValue(request.address);
    return district.aliases.some((alias) => normalizedAddress.includes(normalizeDistrictValue(alias)));
  });

  return addressDistrict?.id ?? getPointDistrictId(request);
}

export function getDistrictById(districtId?: string | null) {
  return ASTANA_MAP_DISTRICTS.find((district) => district.id === districtId) ?? null;
}

export function getDistrictName(districtId?: string | null) {
  if (districtId === CITY_DISTRICT_ID) {
    return "Вся Астана";
  }

  return getDistrictById(districtId)?.name ?? "Район не определён";
}

export function filterRequestsByDistrict(requests: CivicRequest[], districtId: string) {
  if (districtId === CITY_DISTRICT_ID) {
    return requests;
  }

  return requests.filter((request) => getRequestDistrictId(request) === districtId);
}

export function getDistrictLoadLevel(count: number, maxCount: number): DistrictLoadLevel {
  if (count <= 0 || maxCount <= 0) {
    return "low";
  }

  const ratio = count / maxCount;

  if (ratio >= 0.85) {
    return "critical";
  }

  if (ratio >= 0.6) {
    return "high";
  }

  if (ratio >= 0.3) {
    return "medium";
  }

  return "low";
}

export function getDistrictLoadLabel(level: DistrictLoadLevel) {
  const labels: Record<DistrictLoadLevel, string> = {
    low: "Низкая нагрузка",
    medium: "Средняя нагрузка",
    high: "Высокая нагрузка",
    critical: "Критическая нагрузка",
  };

  return labels[level];
}

export function getDistrictBounds(districtId?: string | null) {
  return getDistrictById(districtId)?.bounds ?? null;
}

export function buildDistrictFeatureCollection(
  requests: CivicRequest[],
  selectedDistrictId: string,
) {
  const counts = ASTANA_MAP_DISTRICTS.map((district) =>
    requests.filter((request) => getRequestDistrictId(request) === district.id).length,
  );
  const maxCount = Math.max(...counts, 1);

  return {
    type: "FeatureCollection",
    features: ASTANA_MAP_DISTRICTS.flatMap((district, index) => {
      if (!district.geometry) {
        return [];
      }

      const selected = selectedDistrictId === district.id;
      const dimmed = selectedDistrictId !== CITY_DISTRICT_ID && !selected;
      const count = counts[index] ?? 0;
      const load = getDistrictLoadLevel(count, maxCount);

      return [{
        type: "Feature",
        geometry: district.geometry,
        properties: {
          districtId: district.id,
          name: district.name,
          count,
          load,
          selected,
          dimmed,
          sourceStatus: district.sourceStatus,
        },
      }];
    }),
  };
}

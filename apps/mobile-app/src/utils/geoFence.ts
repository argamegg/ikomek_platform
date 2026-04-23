const EARTH_RADIUS_KM = 6371;

export const ASTANA_CENTER_LAT = 51.1282;
export const ASTANA_CENTER_LNG = 71.4306;
export const ASTANA_MAX_RADIUS_KM = 60;

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function isWithinAstanaRequestZone(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }

  return haversineDistanceKm(lat, lng, ASTANA_CENTER_LAT, ASTANA_CENTER_LNG) <= ASTANA_MAX_RADIUS_KM;
}

export function getDistanceToAstanaKm(lat: number, lng: number): number {
  return haversineDistanceKm(lat, lng, ASTANA_CENTER_LAT, ASTANA_CENTER_LNG);
}
